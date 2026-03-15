require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const compression  = require('compression');

// ── Logger structuré Pino (remplace console.log en prod) ────
const { logger, requestLogger } = require('./middleware/logger');

// ── Middleware SEO & vocal ───────────────────────────────────
const { startSEOEngine, injectSEO } = require('./middleware/seoEngine');
const { warmupVocalTag }             = require('./middleware/vocalTag');

// ── Sécurité ─────────────────────────────────────────────────
const {
  helmetConfig, globalLimiter, mongoSanitizeConfig, hppConfig,
  sanitizeBody, corsOptions, securityLogger, preventPathTraversal,
  requestSizeLimits, validateJWT, preventPrototypePollution, blockMaliciousBots,
  loginLimiter, uploadLimiter, chatLimiter,
} = require('./middleware/security');

const app = express();

// ── Middleware pipeline ──────────────────────────────────────
app.set('trust proxy', 1); // Render.com / reverse proxy
app.use(requestLogger);    // 📋 Log structuré chaque requête
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: requestSizeLimits.json }));
app.use(express.urlencoded({ extended: true, limit: requestSizeLimits.urlencoded }));
app.use(preventPathTraversal);
app.use(blockMaliciousBots);
app.use(globalLimiter);
app.use(mongoSanitizeConfig);
app.use(hppConfig);
app.use(sanitizeBody);
app.use(preventPrototypePollution);
app.use(validateJWT);
app.use(securityLogger);

// ── Fichiers statiques ───────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Audio/vidéo : pas de cache agressif
    if (/\.(mp3|mp4|wav|ogg|flac|aac)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

// ── MongoDB ───────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS:          45000,
  maxPoolSize:              10, // ✅ mongoose 8 — remplace poolSize
})
.then(() => logger.info('MongoDB connecté'))
.catch(err => {
  logger.error({ event: 'mongodb_error', message: err.message });
  process.exit(1);
});

// ── Routes ───────────────────────────────────────────────────
app.use('/',                       require('./routes/health'));       // /health /ready
app.use('/',                       require('./routes/seo'));
app.use('/',                       require('./routes/linkImporter'));
app.use('/api/songs',              require('./routes/songs'));
app.use('/api/videos',             require('./routes/videos'));
app.use('/api/artists',            require('./routes/artists'));
app.use('/api/comments',           require('./routes/comments'));
app.use('/api/playlists',          require('./routes/playlists'));    // 🆕 v16
app.use('/api/notifications',      require('./routes/notifications'));
app.use('/api/admin/login',        loginLimiter);
app.use('/api/admin/upload-song',  uploadLimiter);
app.use('/api/admin/upload-video', uploadLimiter);
app.use('/api/admin',              require('./routes/admin'));
app.use('/api/chat',   chatLimiter, require('./routes/chat'));
app.use('/api/subscribe',          require('./routes/subscribers'));

// ── SSR index.html ────────────────────────────────────────────
let indexHtmlTemplate = null;
function getIndexTemplate() {
  if (!indexHtmlTemplate) {
    indexHtmlTemplate = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  }
  return indexHtmlTemplate;
}

app.get('/admin',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/mastering',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'mastering.html')));
app.get('/artiste/:name', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/playlist/:id',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('*', (req, res) => {
  try {
    const html = injectSEO(getIndexTemplate(), req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(html);
  } catch {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── Error handler global ─────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error({ event: 'unhandled_error', message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erreur interne' : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🎵 MichiNo- v16 démarré sur le port ${PORT}`);
  logger.info('🔒 Sécurité: 13 couches actives (helmet 8 compliant)');
  logger.info('🆕 Playlists IA, cursor pagination, MediaSession actifs');
  startSEOEngine();
  const { startAuditScheduler } = require('./middleware/seoAuditor');
  startAuditScheduler();
  warmupVocalTag();
});

// ── Gestion erreurs non capturées ────────────────────────────
process.on('unhandledRejection', err => logger.error({ event: 'unhandled_rejection', message: err?.message }));
process.on('uncaughtException',  err => {
  logger.error({ event: 'uncaught_exception', message: err.message });
  process.exit(1);
});
