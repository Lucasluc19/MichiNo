const router  = require('express').Router();
const { query, param, validationResult } = require('express-validator');
const Song    = require('../models/Song');

// ══════════════════════════════════════════════════════════════
// GET /api/songs — Pagination cursor-based (standard 2026)
// Remplace .skip() obsolète par range query sur _id
// ══════════════════════════════════════════════════════════════
router.get('/',
  query('search').optional().isString().trim().isLength({ max: 100 }).escape(),
  query('genre').optional().isString().trim().isLength({ max: 50 }).escape(),
  query('artist').optional().isString().trim().isLength({ max: 100 }).escape(),
  query('cursor').optional().isString().trim(),  // _id du dernier item reçu
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('page').optional().isInt({ min: 1 }), // fallback compatibilité
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Paramètres invalides' });
    try {
      const now   = new Date();
      const limit = Math.min(50, parseInt(req.query.limit) || 24);
      const cursor = req.query.cursor; // _id de la dernière chanson de la page précédente

      const conditions = [
        { $or: [{ publishAt: null }, { publishAt: { $lte: now } }] }
      ];

      if (req.query.search) {
        const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        conditions.push({ $or: [
          { title:  { $regex: safe, $options: 'i' } },
          { artist: { $regex: safe, $options: 'i' } },
        ]});
      }
      if (req.query.genre && req.query.genre !== 'all') {
        conditions.push({ genre: req.query.genre });
      }
      if (req.query.artist) {
        const safe = req.query.artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        conditions.push({ artist: { $regex: `^${safe}$`, $options: 'i' } });
      }

      // Cursor-based : si cursor fourni, on prend uniquement les items après ce _id
      if (cursor && /^[a-fA-F0-9]{24}$/.test(cursor)) {
        conditions.push({ _id: { $lt: cursor } });
      }

      const filter = conditions.length > 1 ? { $and: conditions } : conditions[0];

      // Fallback page-based pour compatibilité admin
      const page = parseInt(req.query.page) || 1;
      const useCursor = !!cursor;

      const [songs, total] = await Promise.all([
        Song.find(filter)
          .sort({ order: 1, createdAt: -1 })
          .limit(limit + 1) // +1 pour détecter s'il y a une page suivante
          .select('-__v -dailyStats'),
        Song.countDocuments({ $and: [
          { $or: [{ publishAt: null }, { publishAt: { $lte: now } }] },
          ...(req.query.genre && req.query.genre !== 'all' ? [{ genre: req.query.genre }] : []),
          ...(req.query.artist ? [{ artist: { $regex: `^${req.query.artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }] : []),
        ]}),
      ]);

      const hasMore = songs.length > limit;
      const items   = hasMore ? songs.slice(0, limit) : songs;
      const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;

      res.json({
        songs: items,
        total,
        // Cursor-based (standard 2026)
        nextCursor,
        hasMore,
        // Fallback page-based
        page,
        pages: Math.ceil(total / limit),
        limit,
      });
    } catch (err) {
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// GET /api/songs/artists — liste artistes + stats (agrégation)
router.get('/artists', async (req, res) => {
  try {
    const now = new Date();
    const agg = await Song.aggregate([
      { $match: { $or: [{ publishAt: null }, { publishAt: { $lte: now } }] } },
      { $group: {
        _id:              '$artist',
        songs:            { $sum: 1 },
        downloads:        { $sum: '$downloads' },
        plays:            { $sum: '$plays' },
        totalCompletions: { $sum: '$totalCompletions' },
        skipCount:        { $sum: '$skipCount' },
        genres:           { $addToSet: '$genre' },
        moodTags:         { $push: '$moodTags' },
        covers:           { $push: '$coverImage' },
        latest:           { $max: '$createdAt' },
      }},
      { $sort: { downloads: -1 } },
    ]);
    res.json(agg.map(a => ({
      name:      a._id,
      songs:     a.songs,
      downloads: a.downloads,
      plays:     a.plays,
      genres:    a.genres.filter(Boolean),
      moodTags:  [...new Set(a.moodTags.flat().filter(Boolean))],
      cover:     a.covers.find(Boolean) || '',
      latest:    a.latest,
    })));
  } catch { res.status(500).json({ message: 'Erreur' }); }
});

// POST /api/songs/:id/play
router.post('/:id/play', async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    await Song.findByIdAndUpdate(req.params.id, {
      $inc: { plays: 1 },
      $push: { dailyStats: { $each: [{ date: today, plays: 1, downloads: 0 }], $slice: -90 } },
    });
    res.json({ message: 'ok' });
  } catch { res.json({ message: 'ok' }); }
});

// POST /api/songs/:id/skip — 🆕 v16 : signal skip (< 30s)
router.post('/:id/skip', async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
  await Song.findByIdAndUpdate(req.params.id, { $inc: { skipCount: 1 } }).catch(() => {});
  res.json({ message: 'ok' });
});

// POST /api/songs/:id/complete — 🆕 v16 : signal complétion (> 80%)
router.post('/:id/complete', async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    await Song.findByIdAndUpdate(req.params.id, {
      $inc: { totalCompletions: 1 },
      $push: { dailyStats: { $each: [{ date: today, completions: 1 }], $slice: -90 } },
    });
    res.json({ message: 'ok' });
  } catch { res.json({ message: 'ok' }); }
});

// POST /api/songs/:id/download
router.post('/:id/download', async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    await Song.findByIdAndUpdate(req.params.id, {
      $inc: { downloads: 1 },
      $push: { dailyStats: { $each: [{ date: today, plays: 0, downloads: 1 }], $slice: -90 } },
    });
    res.json({ message: 'ok' });
  } catch { res.json({ message: 'ok' }); }
});

module.exports = router;
