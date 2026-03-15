const router = require('express').Router();
const { param, query, validationResult } = require('express-validator');
const Song    = require('../models/Song');
const Video   = require('../models/Video');
const Comment = require('../models/Comment');

// GET /api/artists  — liste tous les artistes avec stats
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const songs = await Song.find({ $or: [{ publishAt: null }, { publishAt: { $lte: now } }] })
      .select('artist downloads plays genre coverImage createdAt');
    
    const map = {};
    songs.forEach(s => {
      if (!map[s.artist]) map[s.artist] = {
        name: s.artist, songs: 0, downloads: 0, plays: 0,
        genres: new Set(), coverImage: s.coverImage || null, lastRelease: s.createdAt,
      };
      const a = map[s.artist];
      a.songs++;
      a.downloads += s.downloads || 0;
      a.plays     += s.plays     || 0;
      if (s.genre) a.genres.add(s.genre);
      if (!a.coverImage && s.coverImage) a.coverImage = s.coverImage;
      if (s.createdAt > a.lastRelease) a.lastRelease = s.createdAt;
    });
    
    const artists = Object.values(map).map(a => ({
      ...a, genres: [...a.genres],
    })).sort((a, b) => b.downloads - a.downloads);
    
    res.json(artists);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET /api/artists/:name  — profil complet d'un artiste
router.get('/:name',
  param('name').isString().trim().isLength({ min: 1, max: 200 }),
  query('page').optional().isInt({ min: 1 }),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Nom invalide' });
    try {
      const name = decodeURIComponent(req.params.name);
      const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const artistFilter = { artist: { $regex: `^${safe}$`, $options: 'i' } };
      const now  = new Date();
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = 20;

      const [songs, videos, totalSongs] = await Promise.all([
        Song.find({ ...artistFilter, $or: [{ publishAt: null }, { publishAt: { $lte: now } }] })
          .sort({ order: 1, createdAt: -1 }).skip((page-1)*limit).limit(limit).select('-__v -dailyStats'),
        Video.find(artistFilter).sort({ createdAt: -1 }).limit(12).select('-__v'),
        Song.countDocuments({ ...artistFilter, $or: [{ publishAt: null }, { publishAt: { $lte: now } }] }),
      ]);

      if (!songs.length && !videos.length) return res.status(404).json({ message: 'Artiste introuvable' });

      const allSongs = await Song.find(artistFilter).select('downloads plays genre coverImage createdAt');
      const stats = {
        totalDownloads: allSongs.reduce((a, s) => a + (s.downloads || 0), 0),
        totalPlays:     allSongs.reduce((a, s) => a + (s.plays || 0), 0),
        totalSongs:     allSongs.length,
        genres:         [...new Set(allSongs.map(s => s.genre).filter(Boolean))],
        coverImage:     allSongs.find(s => s.coverImage)?.coverImage || null,
      };

      res.json({ name, songs, videos, stats, totalSongs, page, pages: Math.ceil(totalSongs/limit) });
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  }
);

module.exports = router;
