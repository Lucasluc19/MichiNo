/**
 * ============================================================
 *  🔒 MICHINO- SECURITY SHIELD v16
 *  OWASP Top 10 + Standards 2026
 *  FIXES: helmet 8 breaking changes (xssFilter, dnsPrefetchControl supprimés)
 * ============================================================
 */

const rateLimit    = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const helmet       = require('helmet');
const hpp          = require('hpp');

// ─────────────────────────────────────────────
// 1. 🪖 HELMET 8 — En-têtes HTTP sécurisés
//    FIX v16: supprimé xssFilter (retiré dans helmet 8)
//             supprimé dnsPrefetchControl (retiré dans helmet 8)
//             corrigé permittedCrossDomainPolicies (format helmet 8)
// ─────────────────────────────────────────────
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*"],
      mediaSrc:    ["'self'", "blob:", "https://res.cloudinary.com"],
      connectSrc:  ["'self'", "https://api-inference.huggingface.co", "https://api.cloudinary.com"],
      frameSrc:    ["'self'", "https://www.youtube.com"],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy:  false,
  crossOriginResourcePolicy:  { policy: 'cross-origin' },
  hsts:                       { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff:                    true,
  // ✅ xssFilter SUPPRIMÉ — retiré dans helmet 8 (navigateurs modernes l'ignorent de toute façon)
  referrerPolicy:             { policy: 'strict-origin-when-cross-origin' },
  frameguard:                 { action: 'deny' },
  // ✅ dnsPrefetchControl SUPPRIMÉ — retiré dans helmet 8
  permittedCrossDomainPolicies: { permittedPolicies: 'none' }, // ✅ format helmet 8
});

// ─────────────────────────────────────────────
// 2. ⏱️ RATE LIMITING
// ─────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: 'draft-7', // ✅ header standard 2026
  legacyHeaders: false,
  message: { error: '⛔ Trop de requêtes. Réessayez dans 15 minutes.' },
  skip: (req) => req.path.startsWith('/api/songs') || req.path.startsWith('/api/videos'),
});

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '🔒 Trop de tentatives de connexion. Compte bloqué 1 heure.' },
  skipSuccessfulRequests: true,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: "📁 Limite d'upload atteinte. Réessayez dans 1 heure." },
});

const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '💬 Trop de messages. Attendez quelques minutes.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: "🎨 Limite de génération atteinte. Réessayez dans 1 heure." },
});

// ─────────────────────────────────────────────
// 3. 🧹 SANITISATION — Anti NoSQL Injection
// ─────────────────────────────────────────────
const { logger } = require('./logger');

const mongoSanitizeConfig = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn({ event: 'nosql_injection_attempt', ip: req.ip, field: key });
  },
});

// ─────────────────────────────────────────────
// 4. 🔄 HPP — HTTP Parameter Pollution
// ─────────────────────────────────────────────
const hppConfig = hpp({
  whitelist: ['genre', 'search'],
});

// ─────────────────────────────────────────────
// 5. 🔍 SANITISATION XSS MANUELLE
//    (remplace xss-clean abandonné)
// ─────────────────────────────────────────────
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/script/gi, '')
    .replace(/eval\s*\(/gi, '')
    .replace(/union\s+select/gi, '')
    .replace(/drop\s+table/gi, '')
    .trim()
    .slice(0, 2000);
};

const sanitizeBody = (req, res, next) => {
  if (req.body) {
    const sanitize = (obj) => {
      if (typeof obj === 'string') return sanitizeInput(obj);
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => { obj[key] = sanitize(obj[key]); });
      }
      return obj;
    };
    req.body = sanitize(req.body);
  }
  next();
};

// ─────────────────────────────────────────────
// 6. 📁 VALIDATION FICHIERS UPLOAD
// ─────────────────────────────────────────────
const ALLOWED_AUDIO = ['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/flac','audio/aac','audio/x-m4a'];
const ALLOWED_VIDEO = ['video/mp4','video/mpeg','video/webm','video/ogg','video/quicktime'];
const ALLOWED_IMAGE = ['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'];
const MAX_AUDIO_SIZE = 50  * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10  * 1024 * 1024;

const validateFile = (file, type) => {
  if (!file) return { valid: true };
  const allowedTypes = type === 'audio' ? ALLOWED_AUDIO : type === 'video' ? ALLOWED_VIDEO : ALLOWED_IMAGE;
  const maxSize      = type === 'audio' ? MAX_AUDIO_SIZE : type === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (!allowedTypes.includes(file.mimetype)) return { valid: false, error: `Type non autorisé: ${file.mimetype}` };
  if (file.size > maxSize) return { valid: false, error: `Fichier trop grand (max ${maxSize/1024/1024}MB)` };
  const dangerous = ['.exe','.sh','.php','.py','.bat','.cmd','.ps1'];
  if (dangerous.some(ext => file.originalname.toLowerCase().endsWith(ext))) return { valid: false, error: 'Extension dangereuse' };
  return { valid: true };
};

// ─────────────────────────────────────────────
// 7. 🌐 CORS
// ─────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://michino.onrender.com',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
    ];
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS: Origine non autorisée'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
};

// ─────────────────────────────────────────────
// 8. 📝 LOGGING SÉCURITÉ
// ─────────────────────────────────────────────
const SUSPICIOUS_PATTERNS = [
  '../','..\\','<script','javascript:',
  'UNION SELECT','DROP TABLE','${','#{',
  '/etc/passwd','/etc/shadow','cmd.exe','powershell',
  'eval(','exec(','__proto__',
];

const securityLogger = (req, res, next) => {
  const reqString = JSON.stringify({ url: req.url, body: req.body, query: req.query }).toLowerCase();
  const threat = SUSPICIOUS_PATTERNS.find(s => reqString.includes(s.toLowerCase()));
  if (threat) {
    logger.warn({ event: 'security_threat', ip: req.ip, url: req.url, pattern: threat });
    return res.status(400).json({ error: 'Requête suspecte bloquée' });
  }
  next();
};

// ─────────────────────────────────────────────
// 9. 🛑 ANTI PATH TRAVERSAL
// ─────────────────────────────────────────────
const preventPathTraversal = (req, res, next) => {
  const decoded = decodeURIComponent(req.url);
  if (decoded.includes('..') || decoded.includes('%2e%2e') || decoded.includes('//')) {
    logger.warn({ event: 'path_traversal', ip: req.ip, url: req.url });
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
};

// ─────────────────────────────────────────────
// 10. LIMITE TAILLE REQUÊTES
// ─────────────────────────────────────────────
const requestSizeLimits = { json: '10kb', urlencoded: '10kb' };

// ─────────────────────────────────────────────
// 11. JWT VALIDATION (format uniquement)
// ─────────────────────────────────────────────
const validateJWT = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return next();
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Format token invalide' });
  const token = authHeader.split(' ')[1];
  if (!token || token.length < 10 || token.length > 2048) return res.status(401).json({ error: 'Token invalide' });
  next();
};

// ─────────────────────────────────────────────
// 12. ANTI PROTOTYPE POLLUTION
// ─────────────────────────────────────────────
const preventPrototypePollution = (req, res, next) => {
  // Uniquement sur les requêtes avec body JSON (POST/PUT/PATCH)
  // Les GET simples n'ont pas de body — évite les faux positifs Render health checks
  const hasBody = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
  const hasQuery = req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0;
  if (!hasBody && !hasQuery) return next();

  const checkObj = (obj) => {
    if (obj && typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.includes('__proto__') || keys.includes('constructor') || keys.includes('prototype')) return true;
      return Object.values(obj).some(v => typeof v === 'object' && v !== null && checkObj(v));
    }
    return false;
  };
  if (checkObj(req.body) || checkObj(req.query)) {
    logger.warn({ event: 'prototype_pollution', ip: req.ip });
    return res.status(400).json({ error: 'Requête malveillante bloquée' });
  }
  next();
};

// ─────────────────────────────────────────────
// 13. ANTI-BOT
// ─────────────────────────────────────────────
const BLOCKED_BOTS = ['sqlmap','nikto','masscan','nmap','scrapy','zgrab','dirbuster','gobuster'];
const blockMaliciousBots = (req, res, next) => {
  const ua = (req.get('user-agent') || '').toLowerCase();
  if (BLOCKED_BOTS.some(bot => ua.includes(bot))) {
    logger.warn({ event: 'bot_blocked', ip: req.ip, ua });
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
};

module.exports = {
  helmetConfig, globalLimiter, loginLimiter, uploadLimiter, chatLimiter, aiLimiter,
  mongoSanitizeConfig, hppConfig, sanitizeBody, validateFile, corsOptions,
  securityLogger, preventPathTraversal, requestSizeLimits, validateJWT,
  preventPrototypePollution, blockMaliciousBots,
};
  
