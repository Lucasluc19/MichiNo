/**
 * 🔗 Importateur de lien plateforme — MichiNo-
 * ═══════════════════════════════════════════════════════════════
 * Extrait automatiquement les métadonnées d'un lien musical
 * depuis n'importe quelle plateforme de distribution.
 *
 * Plateformes supportées :
 *   Audiomack · Boomplay · SoundCloud · YouTube · Spotify
 *   Deezer · Apple Music · Napster · Tidal · Amazon Music
 *
 * Pipeline :
 *   1. Détection de la plateforme via l'URL
 *   2. Extraction via oEmbed (si dispo) ou scraping HTML
 *   3. Nettoyage et normalisation IA des métadonnées
 *   4. Retour JSON : { title, artist, cover, duration, platform }
 * ═══════════════════════════════════════════════════════════════
 */

const router = require('express').Router();
const auth   = require('../middleware/auth');

// ── Détection de plateforme ──────────────────────────────────
const PLATFORMS = [
  { id: 'audiomack',    name: 'Audiomack',    color: '#ffa500', emoji: '🎵',
    pattern: /audiomack\.com/i,
    oembed: null },

  { id: 'boomplay',     name: 'Boomplay',     color: '#e91e63', emoji: '🎶',
    pattern: /boomplay\.com/i,
    oembed: null },

  { id: 'soundcloud',   name: 'SoundCloud',   color: '#ff5500', emoji: '☁️',
    pattern: /soundcloud\.com/i,
    oembed: (url) => `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json` },

  { id: 'youtube',      name: 'YouTube',      color: '#ff0000', emoji: '▶️',
    pattern: /(?:youtube\.com|youtu\.be)/i,
    oembed: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json` },

  { id: 'spotify',      name: 'Spotify',      color: '#1db954', emoji: '💚',
    pattern: /open\.spotify\.com/i,
    oembed: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}` },

  { id: 'deezer',       name: 'Deezer',       color: '#a238ff', emoji: '🎧',
    pattern: /deezer\.com/i,
    oembed: (url) => `https://api.deezer.com/oembed?url=${encodeURIComponent(url)}&format=json` },

  { id: 'applemusic',   name: 'Apple Music',  color: '#fc3c44', emoji: '🍎',
    pattern: /music\.apple\.com/i,
    oembed: (url) => `https://embedder.apple.com/oembed?url=${encodeURIComponent(url)}&format=json` },

  { id: 'tidal',        name: 'Tidal',        color: '#00ffff', emoji: '🌊',
    pattern: /tidal\.com/i,
    oembed: null },

  { id: 'napster',      name: 'Napster',      color: '#0066ff', emoji: '🎼',
    pattern: /napster\.com/i,
    oembed: null },

  { id: 'amazon',       name: 'Amazon Music', color: '#00a8e1', emoji: '📦',
    pattern: /music\.amazon\./i,
    oembed: null },

  { id: 'audiomack_ng', name: 'Audiomack NG', color: '#ffa500', emoji: '🎵',
    pattern: /audiomack\.com/i,
    oembed: null },
];

function detectPlatform(url) {
  return PLATFORMS.find(p => p.pattern.test(url)) || {
    id: 'unknown', name: 'Lien direct', color: '#888', emoji: '🎵', oembed: null
  };
}

// ── Extraction oEmbed ────────────────────────────────────────
async function fetchOembed(oembedUrl) {
  try {
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'MichiNo-Bot/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Scraping HTML basique ────────────────────────────────────
async function scrapeHtmlMeta(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MichiNo-Bot/1.0)',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extraire les meta tags Open Graph et Twitter
    const get = (pattern) => {
      const m = html.match(pattern);
      return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() : null;
    };

    return {
      title:       get(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
                || get(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
                || get(/<title[^>]*>([^<|]+)/i),
      image:       get(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                || get(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i),
      description: get(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
                || get(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i),
      siteName:    get(/property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i),
    };
  } catch (e) {
    console.warn('Scrape failed:', e.message);
    return null;
  }
}

// ── Nettoyage IA des métadonnées ─────────────────────────────
async function cleanMetadataWithAI(rawTitle, rawDescription, platform, url) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !rawTitle) return null;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Tu es un expert en métadonnées musicales.

Titre brut récupéré sur ${platform}: "${rawTitle}"
Description: "${(rawDescription || '').substring(0, 200)}"

Extrait le vrai titre de la chanson et l'artiste.
Les titres de plateformes contiennent souvent : "by Artiste", "- Artiste", "| Artiste", "Artiste - Titre", etc.

Réponds UNIQUEMENT en JSON valide sans backticks :
{"title":"...","artist":"..."}

Si impossible à déterminer avec certitude, utilise le titre brut nettoyé et laisse artist vide.`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) return null;
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch { return null; }
}

// ── Extraction manuelle selon plateforme ────────────────────
function parseFromTitle(rawTitle, platformId) {
  if (!rawTitle) return { title: '', artist: '' };

  let title  = rawTitle;
  let artist = '';

  // Patterns communs selon la plateforme
  const patterns = [
    // "Titre - Artiste" ou "Artiste - Titre"
    /^(.+?)\s+[-–—]\s+(.+)$/,
    // "Titre by Artiste"
    /^(.+?)\s+by\s+(.+)$/i,
    // "Titre | Artiste"
    /^(.+?)\s+[|]\s+(.+)$/,
  ];

  for (const pat of patterns) {
    const m = rawTitle.match(pat);
    if (m) {
      // Heuristique : le plus court est souvent le titre, le plus long l'artiste
      // Sauf sur Audiomack : format "Artiste - Titre"
      if (platformId === 'audiomack' || platformId === 'boomplay') {
        artist = m[1].trim();
        title  = m[2].trim();
      } else {
        title  = m[1].trim();
        artist = m[2].trim();
      }
      break;
    }
  }

  // Nettoyer les suffixes parasites
  const suffixes = [
    / - (Official|Audio|Video|Lyrics|Music Video|Visualizer|ft\.|feat\.).*/i,
    / \(Official.*?\)/i,
    / \[Official.*?\]/i,
    / \| .*$/,
    / - YouTube$/i,
    / - SoundCloud$/i,
    / - Audiomack$/i,
    / - Boomplay$/i,
    / - Spotify$/i,
    / - Deezer$/i,
  ];
  for (const s of suffixes) title = title.replace(s, '').trim();

  return { title, artist };
}

// ══════════════════════════════════════════════════════════════
//  ROUTE PRINCIPALE : POST /api/link-import
// ══════════════════════════════════════════════════════════════
router.post('/api/link-import', auth, async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL manquante' });
  }

  // Valider URL basique
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: 'URL invalide — vérifiez le format' });
  }

  const platform = detectPlatform(url);
  console.log(`🔗 Import lien — Plateforme: ${platform.name} — URL: ${url.substring(0, 80)}`);

  let metadata = { title: '', artist: '', cover: '', duration: '', platform };

  try {
    // ── Étape 1 : Essayer oEmbed ───────────────────────────
    if (platform.oembed) {
      const oembed = await fetchOembed(platform.oembed(url));
      if (oembed) {
        const parsed = parseFromTitle(oembed.title || '', platform.id);
        // Certaines oEmbed retournent author_name = artiste directement
        metadata.title  = parsed.title  || oembed.title || '';
        metadata.artist = oembed.author_name || parsed.artist || '';
        metadata.cover  = oembed.thumbnail_url || '';
        metadata.duration = oembed.duration
          ? `${Math.floor(oembed.duration / 60)}:${String(oembed.duration % 60).padStart(2, '0')}`
          : '';
        console.log(`  ✅ oEmbed OK — titre: "${metadata.title}", artiste: "${metadata.artist}"`);
      }
    }

    // ── Étape 2 : Scraping HTML si oEmbed insuffisant ─────
    if (!metadata.title || !metadata.cover) {
      const scraped = await scrapeHtmlMeta(url);
      if (scraped) {
        if (!metadata.title && scraped.title) {
          const parsed = parseFromTitle(scraped.title, platform.id);
          metadata.title  = metadata.title  || parsed.title;
          metadata.artist = metadata.artist || parsed.artist;
        }
        metadata.cover = metadata.cover || scraped.image || '';
        metadata._rawTitle = scraped.title;
        metadata._rawDesc  = scraped.description;
        console.log(`  ✅ Scraping OK — titre brut: "${scraped.title?.substring(0, 60)}"`);
      }
    }

    // ── Étape 3 : Nettoyage IA si disponible ──────────────
    if (process.env.ANTHROPIC_API_KEY && (metadata._rawTitle || metadata.title)) {
      const aiMeta = await cleanMetadataWithAI(
        metadata._rawTitle || metadata.title,
        metadata._rawDesc,
        platform.name,
        url
      );
      if (aiMeta) {
        metadata.title  = aiMeta.title  || metadata.title;
        metadata.artist = aiMeta.artist || metadata.artist;
        console.log(`  🤖 IA nettoyage — titre: "${metadata.title}", artiste: "${metadata.artist}"`);
      }
    }

    // Nettoyer les champs internes
    delete metadata._rawTitle;
    delete metadata._rawDesc;

    // Retourner même si partiel
    return res.json({
      ok: true,
      url,
      title:    metadata.title  || '',
      artist:   metadata.artist || '',
      cover:    metadata.cover  || '',
      duration: metadata.duration || '',
      platform: {
        id:    platform.id,
        name:  platform.name,
        color: platform.color,
        emoji: platform.emoji,
      },
    });

  } catch (err) {
    console.error('❌ Erreur link-import:', err.message);
    return res.status(500).json({ error: 'Impossible de récupérer les infos depuis ce lien' });
  }
});

module.exports = router;
