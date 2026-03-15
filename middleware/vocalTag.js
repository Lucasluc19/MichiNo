/**
 * 🎙️ Moteur de Tag Vocal IA — MichiNo-
 * ═══════════════════════════════════════════════════════════════
 * Applique automatiquement un tag vocal "MichiNo-" à chaque son
 * uploadé sur la plateforme.
 *
 * Pipeline :
 *  1. Génère la voix IA "MichiNo-" via ElevenLabs API
 *     → Fallback : jingle WAV généré mathématiquement (aucune dép.)
 *  2. Met en cache le tag audio (généré une seule fois)
 *  3. Soude le tag + silence au DÉBUT de l'audio uploadé via ffmpeg
 *  4. Retourne le buffer audio taggé prêt pour Cloudinary
 *
 * Variables .env :
 *   ELEVENLABS_API_KEY  — Clé API ElevenLabs (optionnel)
 *   ELEVENLABS_VOICE_ID — ID de voix (défaut: voix masculine pro)
 *   VOCAL_TAG_TEXT      — Texte lu (défaut: "MichiNo")
 *   VOCAL_TAG_POSITION  — "intro" | "outro" | "both" (défaut: intro)
 * ═══════════════════════════════════════════════════════════════
 */

const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execSync, spawn } = require('child_process');

// ── Configuration ────────────────────────────────────────────
const TAG_TEXT     = process.env.VOCAL_TAG_TEXT      || 'MichiNo';
const TAG_POSITION = process.env.VOCAL_TAG_POSITION  || 'intro';
const VOICE_ID     = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam — voix pro masculine
const SILENCE_MS   = 400; // silence entre le tag et la musique (ms)

// ── Cache du tag audio généré ────────────────────────────────
const CACHE_DIR  = path.join(os.tmpdir(), 'michino_voctag');
const CACHE_FILE = path.join(CACHE_DIR, 'tag_vocal.mp3');

let tagBufferCache = null; // Buffer en mémoire après première génération

// ── Détection ffmpeg ─────────────────────────────────────────
function getFfmpegPath() {
  // 1. ffmpeg-static (npm package)
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {}
  // 2. Système (Render.com, Linux)
  try {
    const p = execSync('which ffmpeg 2>/dev/null').toString().trim();
    if (p) return p;
  } catch {}
  // 3. Chemin commun Linux
  if (fs.existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  return null;
}

// ══════════════════════════════════════════════════════════════
//  GÉNÉRATION DU TAG AUDIO
// ══════════════════════════════════════════════════════════════

/**
 * Génère le tag vocal via ElevenLabs API
 * Retourne un Buffer MP3 ou null si échec
 */
async function generateViaElevenLabs() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  console.log('🎙️  Génération tag vocal via ElevenLabs IA...');

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept':       'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key':   apiKey,
        },
        body: JSON.stringify({
          text: TAG_TEXT,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability:        0.65,
            similarity_boost: 0.80,
            style:            0.35,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${err.substring(0, 100)}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buf      = Buffer.from(arrayBuf);
    console.log(`✅ Tag vocal ElevenLabs généré (${(buf.length / 1024).toFixed(1)} Ko)`);
    return buf;

  } catch (err) {
    console.warn('⚠️  ElevenLabs échoué, fallback WAV:', err.message);
    return null;
  }
}

/**
 * Fallback : génère un jingle WAV mathématique pur
 * Aucune dépendance externe — 2 notes + fondu
 * Retourne un Buffer WAV
 */
function generateFallbackJingle() {
  console.log('🎵  Génération jingle WAV mathématique (fallback)...');

  const SAMPLE_RATE = 44100;
  const CHANNELS    = 1;
  const BIT_DEPTH   = 16;

  // Séquence musicale : Do → Mi → Sol (accord majeur = positif)
  const notes = [
    { freq: 523.25, dur: 0.18, vol: 0.6 }, // Do5
    { freq: 659.25, dur: 0.18, vol: 0.6 }, // Mi5
    { freq: 783.99, dur: 0.30, vol: 0.7 }, // Sol5 (tenu)
    { freq: 0,      dur: 0.10, vol: 0   }, // silence
    { freq: 1046.5, dur: 0.22, vol: 0.5 }, // Do6 (octave haute)
  ];

  // Générer les samples PCM
  const allSamples = [];
  for (const note of notes) {
    const numSamples = Math.floor(SAMPLE_RATE * note.dur);
    for (let i = 0; i < numSamples; i++) {
      let sample = 0;
      if (note.freq > 0 && note.vol > 0) {
        const t        = i / SAMPLE_RATE;
        // Onde principale + harmonique pour timbre riche
        const wave     = Math.sin(2 * Math.PI * note.freq * t)
                       + 0.3 * Math.sin(4 * Math.PI * note.freq * t)
                       + 0.1 * Math.sin(6 * Math.PI * note.freq * t);
        // Enveloppe ADSR simplifiée (fondu entrée + sortie)
        const fadeLen  = Math.min(numSamples * 0.12, 500);
        let   envelope = 1;
        if (i < fadeLen)                  envelope = i / fadeLen;
        if (i > numSamples - fadeLen)     envelope = (numSamples - i) / fadeLen;
        sample = wave * note.vol * envelope;
      }
      // Clamp & convert to 16-bit int
      const int16 = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
      allSamples.push(int16);
    }
  }

  // Construire le header WAV
  const dataSize   = allSamples.length * 2; // 16-bit = 2 bytes/sample
  const headerSize = 44;
  const buf        = Buffer.alloc(headerSize + dataSize);

  // RIFF chunk
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);           // chunk size
  buf.writeUInt16LE(1, 20);            // PCM
  buf.writeUInt16LE(CHANNELS, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * CHANNELS * BIT_DEPTH / 8, 28); // byte rate
  buf.writeUInt16LE(CHANNELS * BIT_DEPTH / 8, 32);               // block align
  buf.writeUInt16LE(BIT_DEPTH, 34);
  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // Écriture des samples
  for (let i = 0; i < allSamples.length; i++) {
    buf.writeInt16LE(allSamples[i], 44 + i * 2);
  }

  console.log(`✅ Jingle WAV généré (${(buf.length / 1024).toFixed(1)} Ko, ${(allSamples.length / SAMPLE_RATE).toFixed(2)}s)`);
  return buf;
}

/**
 * Retourne le buffer du tag audio (ElevenLabs ou fallback WAV)
 * Mise en cache : généré une seule fois
 */
async function getTagAudio() {
  // 1. Cache mémoire
  if (tagBufferCache) return tagBufferCache;

  // 2. Cache disque
  if (fs.existsSync(CACHE_FILE)) {
    console.log('🎙️  Tag vocal chargé depuis le cache');
    tagBufferCache = fs.readFileSync(CACHE_FILE);
    return tagBufferCache;
  }

  // 3. Générer
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  let tagBuf = await generateViaElevenLabs();
  if (!tagBuf) tagBuf = generateFallbackJingle();

  // Mettre en cache disque
  fs.writeFileSync(CACHE_FILE, tagBuf);
  tagBufferCache = tagBuf;
  return tagBuf;
}

// ══════════════════════════════════════════════════════════════
//  FUSION AUDIO avec ffmpeg
// ══════════════════════════════════════════════════════════════

/**
 * Fusionne [tag audio] + [silence] + [song audio] via ffmpeg
 * Tout en mémoire (tmpfiles) → retourne Buffer MP3
 *
 * @param {Buffer} songBuffer   — Audio original uploadé
 * @param {Buffer} tagBuffer    — Tag audio (MP3 ou WAV)
 * @returns {Buffer}            — Audio final taggé en MP3
 */
function mergeWithFfmpeg(songBuffer, tagBuffer) {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    console.warn('⚠️  ffmpeg non trouvé — tag vocal ignoré, audio original conservé');
    return songBuffer;
  }

  // Fichiers temporaires (préfixés pour nettoyage facile)
  const tmpId    = `michino_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const tmpTag   = path.join(os.tmpdir(), `${tmpId}_tag.mp3`);
  const tmpSong  = path.join(os.tmpdir(), `${tmpId}_song.mp3`);
  const tmpOut   = path.join(os.tmpdir(), `${tmpId}_out.mp3`);
  const tmpList  = path.join(os.tmpdir(), `${tmpId}_list.txt`);

  const cleanup = () => {
    for (const f of [tmpTag, tmpSong, tmpOut, tmpList]) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
  };

  try {
    // Écrire les fichiers temporaires
    fs.writeFileSync(tmpTag,  tagBuffer);
    fs.writeFileSync(tmpSong, songBuffer);

    let merged;

    if (TAG_POSITION === 'both') {
      // intro + outro : tag au début ET à la fin
      const listContent = `file '${tmpTag}'\nfile '${tmpSong}'\nfile '${tmpTag}'`;
      fs.writeFileSync(tmpList, listContent);
      execSync(
        `"${ffmpeg}" -y -f concat -safe 0 -i "${tmpList}" -ar 44100 -ab 192k -f mp3 "${tmpOut}"`,
        { stdio: 'pipe', timeout: 60000 }
      );
    } else if (TAG_POSITION === 'outro') {
      // Tag à la fin uniquement
      const listContent = `file '${tmpSong}'\nfile '${tmpTag}'`;
      fs.writeFileSync(tmpList, listContent);
      execSync(
        `"${ffmpeg}" -y -f concat -safe 0 -i "${tmpList}" -ar 44100 -ab 192k -f mp3 "${tmpOut}"`,
        { stdio: 'pipe', timeout: 60000 }
      );
    } else {
      // intro (défaut) : tag + silence + musique
      // Ajouter un silence entre le tag et la musique
      const silenceSec = SILENCE_MS / 1000;

      // Filtre complexe : [tag][silence][song] → concat propre avec niveau audio normalisé
      execSync(
        `"${ffmpeg}" -y ` +
        `-i "${tmpTag}" ` +
        `-i "${tmpSong}" ` +
        `-filter_complex ` +
        `"[0:a]apad=pad_dur=${silenceSec}[tag_padded];` +
        `[tag_padded][1:a]concat=n=2:v=0:a=1[out];` +
        `[out]loudnorm=I=-14:TP=-1.5:LRA=11[normalized]" ` +
        `-map "[normalized]" -ar 44100 -ab 192k -codec:a libmp3lame "${tmpOut}"`,
        { stdio: 'pipe', timeout: 120000 }
      );
    }

    merged = fs.readFileSync(tmpOut);
    console.log(
      `✅ Tag vocal soudé — ` +
      `Original: ${(songBuffer.length / 1024 / 1024).toFixed(2)} Mo → ` +
      `Taggé: ${(merged.length / 1024 / 1024).toFixed(2)} Mo`
    );
    return merged;

  } catch (err) {
    console.error('❌ Erreur fusion ffmpeg:', err.message);
    // Retourner l'audio original si la fusion échoue
    return songBuffer;
  } finally {
    cleanup();
  }
}

// ══════════════════════════════════════════════════════════════
//  FONCTION PRINCIPALE — Appelée depuis la route upload
// ══════════════════════════════════════════════════════════════

/**
 * Applique le tag vocal IA sur un buffer audio
 *
 * @param {Buffer} audioBuffer — Buffer du fichier audio uploadé
 * @param {string} songTitle   — Titre de la chanson (pour les logs)
 * @returns {Buffer}           — Buffer audio avec tag MichiNo- soudé
 */
async function applyVocalTag(audioBuffer, songTitle = '') {
  try {
    console.log(`🎙️  Application tag vocal sur "${songTitle || 'chanson'}"...`);

    const ffmpeg = getFfmpegPath();
    if (!ffmpeg) {
      console.warn('⚠️  ffmpeg absent — tag vocal désactivé. Installez ffmpeg-static.');
      return audioBuffer;
    }

    // Récupérer/générer le tag audio
    const tagBuffer = await getTagAudio();

    // Fusionner
    const tagged = mergeWithFfmpeg(audioBuffer, tagBuffer);
    return tagged;

  } catch (err) {
    console.error('❌ Erreur applyVocalTag:', err.message);
    return audioBuffer; // Toujours retourner quelque chose
  }
}

/**
 * Pré-chauffe le cache du tag vocal au démarrage du serveur
 * Évite le délai au premier upload
 */
async function warmupVocalTag() {
  try {
    console.log('🎙️  Préchauffage du tag vocal IA...');
    await getTagAudio();
    const ffmpeg = getFfmpegPath();
    console.log(
      ffmpeg
        ? `✅ Tag vocal prêt — ffmpeg: ${ffmpeg}`
        : '⚠️  Tag vocal prêt (jingle) — ffmpeg absent, fusion désactivée'
    );
  } catch (e) {
    console.error('❌ Erreur warmup vocal tag:', e.message);
  }
}

/**
 * Vide le cache pour forcer une régénération du tag
 * (utile si on change le texte ou la voix)
 */
function clearTagCache() {
  tagBufferCache = null;
  try { if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE); } catch {}
  console.log('🗑️  Cache tag vocal vidé');
}

/**
 * Statut du système de tag vocal
 */
function getVocalTagStatus() {
  const ffmpeg = getFfmpegPath();
  return {
    enabled:         !!ffmpeg,
    ffmpegPath:      ffmpeg || null,
    hasElevenLabs:   !!process.env.ELEVENLABS_API_KEY,
    cacheReady:      !!tagBufferCache || fs.existsSync(CACHE_FILE),
    tagText:         TAG_TEXT,
    tagPosition:     TAG_POSITION,
    cacheFile:       CACHE_FILE,
  };
}

module.exports = { applyVocalTag, warmupVocalTag, clearTagCache, getVocalTagStatus };
