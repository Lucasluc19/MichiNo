const router  = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const auth    = require('../middleware/auth');

// GET /api/comments/:songId
router.get('/:songId',
  param('songId').matches(/^[a-fA-F0-9]{24}$/),
  query('page').optional().isInt({ min: 1 }),
  async (req, res) => {
    if (validationResult(req).isEmpty() === false) return res.status(400).json({ message: 'Invalide' });
    try {
      const page  = Math.max(1, parseInt(req.query.page) || 1);
      const limit = 20;
      const [comments, total] = await Promise.all([
        Comment.find({ songId: req.params.songId })
          .sort({ createdAt: -1 })
          .skip((page-1)*limit)
          .limit(limit)
          .select('-__v'),
        Comment.countDocuments({ songId: req.params.songId }),
      ]);
      res.json({ comments, total, page, pages: Math.ceil(total/limit) });
    } catch { res.status(500).json({ message: 'Erreur' }); }
  }
);

// POST /api/comments/:songId
router.post('/:songId',
  param('songId').matches(/^[a-fA-F0-9]{24}$/),
  body('name').isString().trim().isLength({ min: 1, max: 60 }).escape(),
  body('text').isString().trim().isLength({ min: 1, max: 500 }).escape(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Données invalides' });
    try {
      const comment = await Comment.create({
        songId: req.params.songId,
        name:   req.body.name,
        text:   req.body.text,
      });
      res.json({ comment });
    } catch { res.status(500).json({ message: 'Erreur' }); }
  }
);

// POST /api/comments/like/:id
router.post('/like/:id',
  param('id').matches(/^[a-fA-F0-9]{24}$/),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'ID invalide' });
    try {
      await Comment.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } });
      res.json({ message: 'ok' });
    } catch { res.status(500).json({ message: 'Erreur' }); }
  }
);

// DELETE /api/comments/:id  (admin only)
router.delete('/:id', auth,
  param('id').matches(/^[a-fA-F0-9]{24}$/),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'ID invalide' });
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: 'ok' });
  }
);

module.exports = router;
