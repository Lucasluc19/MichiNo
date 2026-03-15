const router     = require('express').Router();
const { body, validationResult } = require('express-validator');
const crypto     = require('crypto');
const Subscriber = require('../models/Subscriber');
const auth       = require('../middleware/auth');

// POST /api/subscribe
router.post('/',
  body('email').isEmail().normalizeEmail(),
  body('name').optional().isString().trim().isLength({ max: 80 }).escape(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Email invalide' });
    try {
      const { email, name } = req.body;
      const token = crypto.randomBytes(24).toString('hex');
      await Subscriber.findOneAndUpdate(
        { email },
        { name: name||'', active: true, token },
        { upsert: true, new: true }
      );
      res.json({ message: 'ok' });
    } catch { res.status(500).json({ message: 'Erreur' }); }
  }
);

// GET /api/subscribe/unsubscribe?token=xxx
router.get('/unsubscribe', async (req, res) => {
  if (!req.query.token) return res.status(400).send('Token manquant');
  try {
    await Subscriber.findOneAndUpdate({ token: req.query.token }, { active: false });
    res.send('<p style="font-family:sans-serif;text-align:center;padding:40px">Désinscription effectuée ✅</p>');
  } catch { res.status(500).send('Erreur'); }
});

// GET /api/subscribe/list  (admin)
router.get('/list', auth, async (req, res) => {
  try {
    const subs = await Subscriber.find({ active: true }).sort({ createdAt: -1 }).select('-__v');
    res.json({ subscribers: subs, total: subs.length });
  } catch { res.status(500).json({ message: 'Erreur' }); }
});

module.exports = router;
