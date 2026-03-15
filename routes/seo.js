/**
 * 🗺️ Routes SEO — MichiNo-
 * /sitemap.xml    — Sitemap dynamique pour Google
 * /robots.txt     — Instructions aux robots d'indexation
 * /api/seo/status — Statut du moteur SEO IA (admin)
 * /api/seo/refresh — Déclencher une régénération manuelle
 */

const router  = require('express').Router();
const Song    = require('../models/Song');
const Video   = require('../models/Video');
const { getSEOCache, generateSEO } = require('../middleware/seoEngine');

// ── Sitemap XML dynamique ────────────────────────────────────
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const now     = new Date().toISOString();

    const [songs, videos] = await Promise.all([
      Song.find().select('_id title artist updatedAt createdAt').sort({ createdAt: -1 }).limit(500),
      Video.find().select('_id title artist updatedAt createdAt').sort({ createdAt: -1 }).limit(200),
    ]);

    // Construire la liste des artistes uniques
    const artistSet = new Map();
    songs.forEach(s => {
      if (s.artist && !artistSet.has(s.artist)) {
        artistSet.set(s.artist, (s.updatedAt || s.createdAt || new Date()).toISOString());
      }
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- Pages principales -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/#videos</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/mastering</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;

    // Entrées des pages artistes (URLs SEO)
    for (const [artist, lastmod] of artistSet) {
      xml += `
  <url>
    <loc>${baseUrl}/artiste/${encodeURIComponent(artist)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
    }

    // Entrées des chansons
    for (const song of songs) {
      const lastmod = (song.updatedAt || song.createdAt || new Date()).toISOString();
      xml += `
  <url>
    <loc>${baseUrl}/?song=${song._id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    // Entrées des vidéos
    for (const video of videos) {
      const lastmod = (video.updatedAt || video.createdAt || new Date()).toISOString();
      xml += `
  <url>
    <loc>${baseUrl}/?video=${video._id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    xml += '\n\n</urlset>';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1h
    res.send(xml);

    console.log(`🗺️  Sitemap servi — ${songs.length} chansons, ${videos.length} vidéos`);
  } catch (err) {
    console.error('Erreur sitemap:', err.message);
    res.status(500).send('<?xml version="1.0"?><error>Erreur génération sitemap</error>');
  }
});

// ── Robots.txt ───────────────────────────────────────────────
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h
  res.send(
`# MichiNo- — Règles d'indexation Google
User-agent: *
Allow: /
Allow: /mastering
Disallow: /admin
Disallow: /api/

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Google Images
User-agent: Googlebot-Image
Allow: /

# Bing
User-agent: Bingbot
Allow: /
Crawl-delay: 1
`
  );
});

// ── API : statut du moteur SEO ───────────────────────────────
router.get('/api/seo/status', (req, res) => {
  const cache = getSEOCache();
  res.json({
    ok:           true,
    lastUpdated:  cache.lastUpdated,
    isLoading:    cache.isLoading,
    hasAI:        !!process.env.ANTHROPIC_API_KEY,
    seo: {
      title:       cache.title,
      description: cache.description,
      keywords:    cache.keywords,
      hasJsonLd:   !!cache.jsonLd,
    },
  });
});

// ── API : régénération manuelle (admin) ──────────────────────
router.post('/api/seo/refresh', async (req, res) => {
  res.json({ message: '🤖 Régénération SEO IA lancée en arrière-plan…' });
  try { await generateSEO(); } catch (e) { console.error(e.message); }
});

module.exports = router;

// ── API : résultats du dernier audit ────────────────────────
const { getAuditCache, runFullAudit } = require('../middleware/seoAuditor');

router.get('/api/seo/audit', (req, res) => {
  const cache = getAuditCache();
  if (!cache.lastRun) {
    return res.json({ message: 'Audit pas encore lancé — patientez quelques secondes après le démarrage.', score: null });
  }
  res.json(cache);
});

// ── API : lancer un audit immédiat ──────────────────────────
router.post('/api/seo/audit/run', async (req, res) => {
  const applyFixes = req.body?.applyFixes === true;
  res.json({ message: `🔍 Audit SEO lancé${applyFixes ? ' + auto-corrections' : ''}…` });
  try { await runFullAudit(applyFixes); } catch (e) { console.error(e.message); }
});

// ═══════════════════════════════════════════════════════════════
//  ROUTES TAG VOCAL IA
// ═══════════════════════════════════════════════════════════════
const { getVocalTagStatus, clearTagCache } = require('../middleware/vocalTag');

// Statut du système de tag vocal
router.get('/api/vocal-tag/status', (req, res) => {
  res.json(getVocalTagStatus());
});

// Vider le cache (forcer régénération de la voix)
router.post('/api/vocal-tag/reset', (req, res) => {
  clearTagCache();
  res.json({ message: '🗑️ Cache tag vocal vidé — prochaine régénération au prochain upload' });
});
