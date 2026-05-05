const express = require('express');
const router = express.Router();
const aiRouteService = require('../services/aiRouteService');

// ─── POST /api/ai/route ──────────────────────────────────
// Calcula la mejor ruta sincronizando datos EMT en tiempo real
router.post('/route', async (req, res) => {
  const { origin, destination } = req.body;
  if (!origin || !destination) {
    return res.status(400).json({ error: true, message: 'Origen y Destino son obligatorios.' });
  }

  try {
    const result = await aiRouteService.calculateRoute(origin, destination);
    res.json(result);
  } catch (err) {
    console.error('Error calculando ruta IA:', err);
    res.status(500).json({ error: true, message: '🤖 **Error interno.** Los servidores del Agente IA están sobrecargados.' });
  }
});

module.exports = router;
