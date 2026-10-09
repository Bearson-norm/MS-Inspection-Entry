const express = require('express');
const path = require('path');
const { pool } = require('./database');
const scanRoutes = require('./routes/scans');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

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
  app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/api/health', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() }); }
    catch (_) { res.status(503).json({ success: false, status: 'unhealthy', timestamp: new Date().toISOString() }); }
  });
  app.use('/api/scans', scanRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Terjadi gangguan pada server.' });
  });
  return app;
}

module.exports = { createApp };
