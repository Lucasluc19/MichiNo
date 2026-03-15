const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

const validateId = param('id').matches(/^[a-fA-F0-9]{24}$/);

// Visiteur: envoyer un message
router.post('/send',
  body('name').isString().trim().isLength({ min: 1, max: 50 }).escape(),
  body('email').optional().isEmail().normalizeEmail(),
  body('text').isString().trim().isLength({ min: 1, max: 500 }).escape(),
  body('sessionId').isString().trim().isLength({ min: 5, max: 100 }).matches(/^[a-zA-Z0-9_-]+$/),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Données invalides' });
    try {
      const { name, email, text, sessionId } = req.body;
      let convo = await Message.findOne({ sessionId });
      if (!convo) {
        convo = new Message({ visitorName: name, visitorEmail: email || '', sessionId, messages: [] });
      }
      // Limiter le nombre de messages par session
      if (convo.messages.length >= 50) {
        return res.status(429).json({ message: 'Limite de messages atteinte pour cette session' });
      }
      convo.messages.push({ from: 'visitor', text });
      convo.status = 'open';
      convo.updatedAt = new Date();
      await convo.save();
      res.json({ message: 'ok', id: convo._id });
    } catch (e) {
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// Visiteur: récupérer ses messages
router.get('/session/:sessionId',
  param('sessionId').isString().isLength({ min: 5, max: 100 }).matches(/^[a-zA-Z0-9_-]+$/),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Session invalide' });
    try {
      const convo = await Message.findOne({ sessionId: req.params.sessionId }).select('-visitorEmail');
      res.json(convo || { messages: [] });
    } catch (e) {
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// ADMIN: toutes les conversations
router.get('/admin/all', auth, async (req, res) => {
  try {
    const convos = await Message.find().sort({ updatedAt: -1 }).limit(200);
    res.json(convos);
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ADMIN: répondre
router.post('/admin/reply/:id', auth, validateId,
  body('text').isString().trim().isLength({ min: 1, max: 1000 }).escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Données invalides' });
    try {
      const convo = await Message.findById(req.params.id);
      if (!convo) return res.status(404).json({ message: 'Conversation introuvable' });
      convo.messages.push({ from: 'admin', text: req.body.text });
      convo.status = 'answered';
      convo.updatedAt = new Date();
      await convo.save();
      res.json({ message: 'ok', convo });
    } catch (e) {
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

router.patch('/admin/close/:id', auth, validateId, async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
  await Message.findByIdAndUpdate(req.params.id, { status: 'closed' });
  res.json({ message: 'ok' });
});

router.delete('/admin/:id', auth, validateId, async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: 'ID invalide' });
  await Message.findByIdAndDelete(req.params.id);
  res.json({ message: 'ok' });
});

module.exports = router;
