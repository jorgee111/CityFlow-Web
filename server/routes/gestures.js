// server/routes/gestures.js
// Recibe alertas del gestureDaemon Python y las reenvía al gestor
// También actúa de proxy para comandos start/stop desde el frontend

const express = require('express');
const router  = express.Router();
const http    = require('http');

const GESTURE_DAEMON_URL = 'http://localhost:6000';

let lastAlert = null;
const alertListeners = []; // SSE clients

// ── Recibir alerta del gestureDaemon (lo llama Python) ───────────
router.post('/alert', (req, res) => {
  const { alert, source } = req.body;
  lastAlert = { type: alert, source: source || 'gestureDaemon', timestamp: new Date().toISOString() };

  console.log(`[GESTO] Alerta recibida: ${alert}`);

  // Notificar a todos los clientes SSE conectados
  const payload = `data: ${JSON.stringify(lastAlert)}\n\n`;
  alertListeners.forEach(client => { try { client.write(payload); } catch {} });

  res.json({ received: true });
});

// ── SSE: el frontend se suscribe para recibir alertas en tiempo real ──
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  alertListeners.push(res);

  // Enviar última alerta si existe
  if (lastAlert) {
    res.write(`data: ${JSON.stringify(lastAlert)}\n\n`);
  }

  req.on('close', () => {
    const idx = alertListeners.indexOf(res);
    if (idx > -1) alertListeners.splice(idx, 1);
  });
});

// ── Última alerta guardada ─────────────────────────────────────────
router.get('/last', (req, res) => {
  res.json(lastAlert || { type: null, timestamp: null });
});

// ── Proxy a los Agentes IA Python ──────────────────────────────────
function proxyToAgent(port, req, res) {
  const options = {
    hostname: '127.0.0.1', port: port,
    path: '/chat', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };
  const req2 = http.request(options, r => {
    let data = '';
    r.on('data', c => data += c);
    r.on('end', () => res.send(data));
  });
  req2.on('error', () => res.status(503).json({ error: 'Asistente IA no disponible.' }));
  req2.write(JSON.stringify(req.body));
  req2.end();
}

router.post('/chat/pasajero',  (req, res) => proxyToAgent(5000, req, res));
router.post('/chat/conductor', (req, res) => proxyToAgent(5002, req, res));
router.post('/chat/gestor',    (req, res) => proxyToAgent(5003, req, res));

module.exports = router;
