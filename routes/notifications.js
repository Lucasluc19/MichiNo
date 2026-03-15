/**
 * /api/notifications
 *
 * Système unifié : Push web (VAPID) + Newsletter email
 * Modèles : PushSub (abonnements push) + Subscriber (newsletter email)
 */
const router     = require('express').Router();
const { body, validationResult } = require('express-validator');
const crypto     = require('crypto');
const auth       = require('../middleware/auth');
const { sendNewsletter, sendWelcomeEmail } = require('../middleware/mailer');
const PushSub    = require('../models/PushSub');
const Subscriber = require('../models/Subscriber');

// ── web-push (optionnel — fonctionne sans si VAPID non configuré) ──
let webpush;
try { webpush = require('web-push'); } catch { webpush = null; }

function initVapid() {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(
      'mailto:' + (process.env.VAPID_EMAIL || 'admin@michino.com'),
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    return true;
  } catch { return false; }
}

// ── Fonction utilitaire : broadcast push à tous les abonnés ───────
async function broadcastPush(title, bodyText, url = '/') {
  if (!initVapid()) return { sent: 0, failed: 0, error: 'VAPID non configuré' };
  const subs = await PushSub.find().limit(10000);
  const payload = JSON.stringify({
    title, body: bodyText, url,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  });
  let sent = 0, failed = 0;
  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload))
  );
  const expired = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { sent++; }
    else {
      failed++;
      if ([404, 410].includes(r.reason?.statusCode)) expired.push(subs[i].endpoint);
    }
  });
  if (expired.length) await PushSub.deleteMany({ endpoint: { $in: expired } }).catch(() => {});
  return { sent, failed };
}

// ═══════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

// GET /api/notifications/push/vapid-public — clé publique pour le SW
router.get('/push/vapid-public', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

// POST /api/notifications/push/subscribe
router.post('/push/subscribe',
  body('endpoint').isURL({ protocols: ['https'], require_protocol: true }),
  body('keys').isObject(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Données invalides' });
    try {
      const { endpoint, keys, lang } = req.body;
      await PushSub.findOneAndUpdate(
        { endpoint },
        { endpoint, keys, lang: lang || 'fr' },
        { upsert: true, new: true }
      );
      res.json({ message: 'Abonné aux notifications !' });
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  }
);

// POST /api/notifications/push/unsubscribe
router.post('/push/unsubscribe',
  body('endpoint').isURL(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Invalide' });
    await PushSub.deleteOne({ endpoint: req.body.endpoint }).catch(() => {});
    res.json({ message: 'ok' });
  }
);

// POST /api/notifications/push/send — admin : envoyer une notif manuelle
router.post('/push/send', auth,
  body('title').isString().trim().isLength({ min: 1, max: 100 }).escape(),
  body('body').isString().trim().isLength({ min: 1, max: 200 }).escape(),
  body('url').optional().isString(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Données invalides' });
    if (!initVapid()) {
      return res.status(503).json({
        message: 'VAPID non configuré — ajoutez VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans les variables d\'environnement Render',
      });
    }
    const result = await broadcastPush(req.body.title, req.body.body, req.body.url || '/');
    res.json({ message: `Envoyé: ${result.sent}, Échecs: ${result.failed}`, ...result });
  }
);

// ═══════════════════════════════════════════════════════════════
//  NEWSLETTER EMAIL
// ═══════════════════════════════════════════════════════════════

// POST /api/notifications/newsletter/subscribe
router.post('/newsletter/subscribe',
  body('email').isEmail().normalizeEmail(),
  body('name').optional().isString().trim().isLength({ max: 80 }).escape(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Email invalide' });
    try {
      const token = crypto.randomBytes(24).toString('hex');
      const result = await Subscriber.findOneAndUpdate(
        { email: req.body.email },
        { email: req.body.email, name: req.body.name || '', active: true, token },
        { upsert: true, new: true }
      );
      // Email de bienvenue (non-bloquant)
      if (result) sendWelcomeEmail(req.body.email, req.body.name || '').catch(() => {});
      res.json({ message: 'Inscrit à la newsletter !' });
    } catch (e) {
      if (e.code === 11000) return res.json({ message: 'Déjà inscrit !' });
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// GET /api/notifications/newsletter/unsubscribe?token=xxx
router.get('/newsletter/unsubscribe', async (req, res) => {
  if (!req.query.token) return res.status(400).send('Token manquant');
  try {
    await Subscriber.findOneAndUpdate({ token: req.query.token }, { active: false });
    res.send('✅ Désabonné avec succès. Tu peux fermer cette page.');
  } catch { res.status(500).send('Erreur'); }
});

// POST /api/notifications/newsletter/unsubscribe (via body)
router.post('/newsletter/unsubscribe',
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Email invalide' });
    await Subscriber.findOneAndUpdate({ email: req.body.email }, { active: false }).catch(() => {});
    res.json({ message: 'ok' });
  }
);

// ═══════════════════════════════════════════════════════════════
//  STATS ADMIN
// ═══════════════════════════════════════════════════════════════

// GET /api/notifications/stats
router.get('/stats', auth, async (req, res) => {
  const [push, email] = await Promise.all([
    PushSub.countDocuments(),
    Subscriber.countDocuments({ active: true }),
  ]);
  res.json({ push, email });
});

// GET /api/notifications/email-list — liste des inscrits newsletter
router.get('/email-list', auth, async (req, res) => {
  const subs = await Subscriber.find({ active: true })
    .select('email name createdAt').sort({ createdAt: -1 }).limit(1000);
  res.json({ subs, total: subs.length });
});

// POST /api/notifications/newsletter/send — admin : envoyer une newsletter
router.post('/newsletter/send', auth,
  body('subject').isString().trim().isLength({ min: 1, max: 200 }),
  body('html').isString().trim().isLength({ min: 1, max: 50000 }),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Données invalides' });
    try {
      const subs = await Subscriber.find({ active: true }).select('email');
      const emails = subs.map(s => s.email);
      if (!emails.length) return res.json({ message: 'Aucun abonné actif', sent: 0, failed: 0 });
      const siteUrl = process.env.SITE_URL || '';
      const result = await sendNewsletter(
        emails,
        req.body.subject,
        req.body.html,
        `${siteUrl}/api/notifications/newsletter/unsubscribe`
      );
      res.json({ message: `Newsletter envoyée: ${result.sent} succès, ${result.failed} échecs`, ...result });
    } catch (e) {
      res.status(500).json({ message: 'Erreur envoi newsletter: ' + e.message });
    }
  }
);

module.exports = router;
module.exports.broadcastPush = broadcastPush;
