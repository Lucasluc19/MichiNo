/**
 * Génère une waveform SVG/JSON à partir d'un buffer audio via ffmpeg.
 * Retourne un tableau de 60 valeurs normalisées [0..1].
 */
const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function getFfmpeg() {
  try { const f = require('ffmpeg-static'); if (f && fs.existsSync(f)) return f; } catch {}
  try { const p = require('child_process').execSync('which ffmpeg 2>/dev/null').toString().trim(); if (p) return p; } catch {}
  return null;
}

/**
 * @param {Buffer} audioBuffer
 * @param {number} bars  nombre de barres (défaut 60)
 * @returns {number[]}  tableau de floats [0..1]
 */
async function generateWaveform(audioBuffer, bars = 60) {
  const ffmpeg = getFfmpeg();
  if (!ffmpeg) return [];

  const tmpIn  = path.join(os.tmpdir(), `wv_in_${Date.now()}.mp3`);
  const tmpOut = path.join(os.tmpdir(), `wv_out_${Date.now()}.txt`);
  try {
    fs.writeFileSync(tmpIn, audioBuffer);
    // Utiliser volumedetect sur des segments courts = approximation de waveform
    // On extrait les niveaux RMS sur N segments via astats filter
    execFileSync(ffmpeg, [
      '-i', tmpIn,
      '-filter_complex', `[0:a]asetnsamples=n=1024,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=${tmpOut}`,
      '-f', 'null', '-'
    ], { stdio: 'pipe', timeout: 30000 });

    if (!fs.existsSync(tmpOut)) return [];
    const raw = fs.readFileSync(tmpOut, 'utf8');
    // Parse les valeurs RMS (en dB, négatifs)
    const vals = [];
    raw.split('\n').forEach(line => {
      const m = line.match(/value=(-?\d+(?:\.\d+)?)/);
      if (m) vals.push(parseFloat(m[1]));
    });

    if (!vals.length) return [];

    // Normaliser vers [0..1] : RMS va de -60dB (silence) à 0dB (max)
    const MIN_DB = -60, MAX_DB = 0;
    const norm = vals.map(v => Math.max(0, Math.min(1, (v - MIN_DB) / (MAX_DB - MIN_DB))));

    // Réduire à N barres par moyenne
    const step   = norm.length / bars;
    const result = [];
    for (let i = 0; i < bars; i++) {
      const from = Math.floor(i * step);
      const to   = Math.min(norm.length, Math.floor((i+1) * step));
      const slice = norm.slice(from, to);
      result.push(slice.length ? slice.reduce((a,b)=>a+b,0)/slice.length : 0);
    }
    return result;
  } catch (e) {
    console.warn('[waveform] erreur:', e.message);
    return [];
  } finally {
    try { fs.unlinkSync(tmpIn);  } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

/**
 * Convertit un tableau de floats [0..1] en SVG inline
 */
function waveformToSVG(bars, width = 300, height = 48, color = '#ff3e00') {
  if (!bars || !bars.length) return '';
  const barW   = width / bars.length;
  const gap    = Math.max(1, barW * 0.2);
  const paths  = bars.map((v, i) => {
    const h = Math.max(2, v * height);
    const x = i * barW + gap / 2;
    const y = (height - h) / 2;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW-gap).toFixed(1)}" height="${h.toFixed(1)}" rx="1"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><g fill="${color}" opacity="0.6">${paths}</g></svg>`;
}

module.exports = { generateWaveform, waveformToSVG };
