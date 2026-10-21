const express = require('express');
const path = require('path');
const config = require('./config');
const { pool } = require('./database');
const scanRoutes = require('./routes/scans');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const publicDir = path.join(__dirname, 'public');
const bootstrapDir = path.join(__dirname, 'node_modules', 'bootstrap', 'dist');
const jsqrDir = path.join(__dirname, 'node_modules', 'jsqr', 'dist');

function mountUi(app, mountPath) {
  const prefix = mountPath || '';
  const vendorPath = prefix ? `${prefix}/vendor/bootstrap` : '/vendor/bootstrap';
  const jsqrVendorPath = prefix ? `${prefix}/vendor/jsqr` : '/vendor/jsqr';
  app.use(vendorPath, express.static(bootstrapDir));
  app.use(jsqrVendorPath, express.static(jsqrDir));
  if (prefix) {
    app.use(prefix, express.static(publicDir));
    app.get(prefix, (_req, res) => res.redirect(301, `${prefix}/`));
    app.get(`${prefix}/`, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
    app.get(`${prefix}/admin`, (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
  } else {
    app.use(express.static(publicDir));
    app.get('/admin', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
  }
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  mountUi(app, config.basePath);

  app.get('/api/inspection/scanner-config', async (_req, res, next) => {
    try {
      const { listActiveCheckpointNames } = require('./services/checkpoints');
      const checkpoints = await listActiveCheckpointNames(pool);
      res.json({
        success: true,
        checkpoint_location: config.checkpointLocation,
        checkpoints,
        selection_required: checkpoints.length > 1
      });
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/inspection/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
    } catch (_) {
      res.status(503).json({ success: false, status: 'unhealthy', timestamp: new Date().toISOString() });
    }
  });
  app.use('/api/scans', scanRoutes);
  app.use('/api/inspection/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Terjadi gangguan pada server.' });
  });
  return app;
}

module.exports = { createApp };
