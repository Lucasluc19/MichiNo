/**
 * 🤖 Moteur SEO IA — MichiNo-
 * ─────────────────────────────────────────────────────────────
 * Génère automatiquement les métadonnées SEO optimisées pour
 * Google grâce à l'IA Claude (Anthropic API).
 *
 * Fonctionnement :
 *  1. Au démarrage, lit les chansons/vidéos en base
 *  2. Appelle Claude pour produire titre, description, mots-clés
 *  3. Met en cache + injecte côté serveur dans index.html
 *  4. Se rafraîchit automatiquement toutes les 24h
 * ─────────────────────────────────────────────────────────────
 */

const Song  = require('../models/Song');
const Video = require('../models/Video');

// ── Cache SEO (valeurs par défaut robustes) ──────────────────
let seoCache = {
  title:          'MichiNo- | Afrobeat, Téléchargement Gratuit & Clips Vidéo',
  description:    'Découvrez les derniers hits Afrobeat sur MichiNo-. Téléchargez gratuitement vos morceaux préférés et regardez les meilleurs clips vidéo africains en HD.',
  keywords:       'musique afrobeat, téléchargement gratuit, clips vidéo, musique africaine, MichiNo, afropop, rnb africain',
  ogTitle:        'MichiNo- | Votre Plateforme Musicale Africaine',
  ogDescription:  'Téléchargez gratuitement les meilleurs sons Afrobeat et regardez les clips en HD. Nouvelle musique chaque semaine.',
  twitterTitle:   'MichiNo- 🎵 Afrobeat Gratuit',
  twitterDescription: 'Les meilleurs hits Afrobeat en téléchargement libre. Clips vidéo HD. Musique africaine premium.',
  jsonLd:         null,
  lastUpdated:    null,
  isLoading:      false,
};

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 heures

// ── Appel Anthropic API ──────────────────────────────────────
async function callAnthropicAPI(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('⚠️  ANTHROPIC_API_KEY absente — SEO IA désactivé, valeurs par défaut utilisées');
    return null;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-6',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

// ── Génération principale ────────────────────────────────────
async function generateSEO() {
  if (seoCache.isLoading) return;
  seoCache.isLoading = true;
  console.log('🤖 Génération SEO IA en cours...');

  try {
    // Récupérer le contenu réel de la base
    const songs  = await Song.find().sort({ downloads: -1 }).limit(15)
                             .select('title artist genre downloads');
    const videos = await Video.find().sort({ views: -1 }).limit(8)
                              .select('title artist views');

    const topSongs  = songs.map(s =>
      `"${s.title}" – ${s.artist} (${s.genre || 'Afrobeat'}, ${s.downloads} dl)`
    ).join(' | ');

    const topVideos = videos.map(v =>
      `"${v.title}" – ${v.artist} (${v.views} vues)`
    ).join(' | ');

    // Prompt SEO expert
    const prompt = `Tu es un expert SEO technique spécialisé dans les plateformes musicales africaines.
Le site MichiNo- est une plateforme de musique africaine : Afrobeat, Afropop, R&B, Hip-Hop.
Les utilisateurs peuvent écouter, télécharger des sons et regarder des clips vidéo gratuitement.

Contenu actuel en base de données :
• Chansons les plus téléchargées : ${topSongs || 'Chargement en cours…'}
• Vidéos les plus vues : ${topVideos || 'Chargement en cours…'}

Génère des métadonnées SEO optimisées pour maximiser le référencement Google en France et en Afrique francophone.
Utilise les vrais noms d'artistes et titres quand c'est pertinent.

Réponds UNIQUEMENT en JSON valide, sans aucun markdown ni backtick, avec exactement ces champs :
{
  "title": "...",
  "description": "...",
  "keywords": "...",
  "ogTitle": "...",
  "ogDescription": "...",
  "twitterTitle": "...",
  "twitterDescription": "..."
}

Contraintes strictes :
- title : 50-60 caractères
- description : 140-155 caractères (inclure un appel à l'action)
- keywords : 12-18 mots-clés séparés par des virgules
- ogTitle : 60-70 caractères
- ogDescription : 180-200 caractères
- twitterTitle : 50-60 caractères
- twitterDescription : 130-150 caractères`;

    const raw = await callAnthropicAPI(prompt);
    if (!raw) { seoCache.isLoading = false; return; }

    // Nettoyer et parser le JSON
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const seoData = JSON.parse(cleaned);

    // Générer le JSON-LD Schema.org (données structurées pour Google)
    const baseUrl = process.env.SITE_URL || 'https://michino.onrender.com';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type':       'WebSite',
          '@id':         `${baseUrl}/#website`,
          url:           baseUrl,
          name:          'MichiNo-',
          description:   seoData.description,
          inLanguage:    'fr-FR',
          potentialAction: {
            '@type':       'SearchAction',
            target:        `${baseUrl}/?search={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type':       'MusicGroup',
          '@id':         `${baseUrl}/#platform`,
          name:          'MichiNo-',
          url:           baseUrl,
          description:   seoData.description,
          genre:         ['Afrobeat', 'Afropop', 'R&B', 'Hip-Hop', 'Musique Africaine'],
          ...(songs.length > 0 && {
            track: songs.slice(0, 8).map(s => ({
              '@type':    'MusicRecording',
              name:       s.title,
              byArtist: {
                '@type': 'MusicGroup',
                name:    s.artist,
              },
            })),
          }),
        },
        {
          '@type':       'ItemList',
          '@id':         `${baseUrl}/#catalog`,
          name:          'Catalogue MichiNo-',
          description:   `${songs.length} chansons disponibles`,
          numberOfItems: songs.length,
        },
      ],
    };

    // Mettre à jour le cache
    seoCache = {
      ...seoData,
      jsonLd,
      lastUpdated: new Date(),
      isLoading:   false,
    };

    console.log('✅ SEO IA régénéré avec succès —', seoCache.title);

  } catch (err) {
    console.error('❌ Erreur SEO IA:', err.message);
    seoCache.isLoading = false;
  }
}

// ── Injecter les meta dans index.html (template) ─────────────
function injectSEO(htmlTemplate, req) {
  const cache   = seoCache;
  const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;

  const metaTags = `
  <!-- ═══ SEO IA — généré automatiquement par MichiNo- ═══ -->
  <title>${escHtml(cache.title)}</title>
  <meta name="description" content="${escHtml(cache.description)}">
  <meta name="keywords" content="${escHtml(cache.keywords)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="author" content="MichiNo-">
  <link rel="canonical" href="${baseUrl}/">

  <!-- Open Graph (Facebook, WhatsApp, etc.) -->
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="${baseUrl}/">
  <meta property="og:site_name"   content="MichiNo-">
  <meta property="og:title"       content="${escHtml(cache.ogTitle)}">
  <meta property="og:description" content="${escHtml(cache.ogDescription)}">
  <meta property="og:locale"      content="fr_FR">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${escHtml(cache.twitterTitle)}">
  <meta name="twitter:description" content="${escHtml(cache.twitterDescription)}">

  <!-- JSON-LD Données Structurées Google -->
  <script type="application/ld+json">
  ${JSON.stringify(cache.jsonLd || {}, null, 2)}
  </script>
  <!-- ═══════════════════════════════════════════════════════ -->`;

  // Remplacer le placeholder dans le template
  return htmlTemplate.replace('<!-- ##SEO_INJECT## -->', metaTags);
}

// ── Démarrage du moteur ──────────────────────────────────────
function startSEOEngine() {
  // Première génération après 4s (laisser MongoDB se connecter)
  setTimeout(generateSEO, 4000);
  // Refresh quotidien
  setInterval(generateSEO, REFRESH_INTERVAL_MS);
  console.log('🤖 Moteur SEO IA démarré — refresh automatique toutes les 24h');
}

// ── Helper escaping HTML ─────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getSEOCache() { return seoCache; }

module.exports = { startSEOEngine, getSEOCache, generateSEO, injectSEO };
