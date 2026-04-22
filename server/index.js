// server/index.js
// Punto de entrada del servidor Express - CityFlow Web

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes       = require('./routes/auth');
const busesRoutes      = require('./routes/buses');
const incidentsRoutes  = require('./routes/incidents');
const suggestionsRoutes = require('./routes/suggestions');
const usersRoutes      = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ──────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Servir archivos estáticos del frontend ───────────────
app.use(express.static(path.join(__dirname, '../public')));

// ─── Rutas API ────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/buses',       busesRoutes);
app.use('/api/incidents',   incidentsRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/users',       usersRoutes);

// ─── Health check para Azure App Service ─────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'CityFlow Web API' });
});

// ─── Manejo de errores global ─────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── SPA Fallback: cualquier ruta no-API sirve el HTML ────
// Esto permite navegar directamente a /dashboard, /mapa, etc.
app.get('*', (req, res) => {
  // Las rutas API ya están manejadas arriba
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  // Para rutas HTML directas servimos el archivo correspondiente
  const htmlFile = req.path === '/' ? 'index.html' : req.path.replace(/^\//, '') + '.html';
  const filePath = path.join(__dirname, '../public', htmlFile);
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// ─── Iniciar servidor ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚌 CityFlow Web corriendo en http://localhost:${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
