/**
 * 📋 Logger structuré MichiNo- — Pino 2026
 * Remplace console.log en production
 * Format JSON en prod, pretty en dev
 */
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
    : undefined,
  base: { service: 'michino', env: process.env.NODE_ENV || 'development' },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, ip: req.remoteAddress }),
    err: pino.stdSerializers.err,
  },
  redact: ['req.headers.authorization', 'body.password', 'body.token'],
});

/**
 * Middleware Express — log chaque requête entrante
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({ method: req.method, url: req.originalUrl, status: res.statusCode, ms });
  });
  next();
}

module.exports = { logger, requestLogger };
