const router = require('express').Router();
const { query, validationResult } = require('express-validator');
const Video = require('../models/Video');

router.get('/',
  query('search').optional().isString().trim().isLength({ max: 100 }).escape(),
  query('artist').optional().isString().trim().isLength({ max: 100 }).escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Paramètres invalides' });
    try {
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 24);
      const conditions = [];

      if (req.query.search) {
        const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        conditions.push({ $or: [
          { title:  { $regex: safe, $options: 'i' } },
          { artist: { $regex: safe, $options: 'i' } },
        ]});
      }
      if (req.query.artist) {
        const safe = req.query.artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        conditions.push({ artist: { $regex: `^${safe}$`, $options: 'i' } });
      }

      const filter = conditions.length ? { $and: conditions } : {};
      const [videos, total] = await Promise.all([
        Video.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).select('-__v'),
        Video.countDocuments(filter),
      ]);
      res.json({ videos, total, page, pages: Math.ceil(total/limit), limit });
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  }
);

router.post('/:id/view', async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
  await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
  res.json({ message: 'ok' });
});

module.exports = router;
