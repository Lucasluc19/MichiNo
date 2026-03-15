/**
 * 🏥 Health Check — MichiNo- v16
 * Standard 2026 : endpoint /health pour load balancers et monitoring
 */
const router   = require('express').Router();
const mongoose = require('mongoose');
const os       = require('os');

router.get('/health', async (req, res) => {
  const start = Date.now();

  // Test connexion MongoDB
  let dbStatus = 'ok';
  try {
    await mongoose.connection.db.admin().ping();
  } catch {
    dbStatus = 'error';
  }

  const healthy = mongoose.connection.readyState === 1;

  res.status(healthy ? 200 : 503).json({
    status:    healthy ? 'ok' : 'degraded',
    version:   '16.0.0',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
    latency:   Date.now() - start,
    services: {
      mongodb: dbStatus,
      memory: {
        used:  Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(os.totalmem() / 1024 / 1024),
        unit:  'MB',
      },
    },
  });
});

// Readiness probe (pour Render.com / k8s)
router.get('/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});

module.exports = router;
