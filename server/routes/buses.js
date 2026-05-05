// server/routes/buses.js
// Rutas de autobuses: datos en tiempo real desde EMT Madrid API

const express = require('express');
const emtService = require('../services/emtService');

const router = express.Router();

// ─── GET /api/buses ───────────────────────────────────────
// Devuelve todos los autobuses activos (público - datos de transporte)
router.get('/', async (req, res) => {
  try {
    const buses = await emtService.getBuses();
    res.json(buses);
  } catch (err) {
    console.error('Error obteniendo buses:', err);
    res.status(500).json({ error: 'Error obteniendo datos de buses' });
  }
});

// ─── GET /api/buses/stats ─────────────────────────────────
// Estadísticas agregadas para el dashboard
router.get('/stats', async (req, res) => {
  try {
    const buses = await emtService.getBuses();
    const active_buses = buses.length;
    let sum_occ = 0;
    let high_occ_count = 0;
    
    buses.forEach(b => {
      sum_occ += b.occupancy_pct;
      if (b.occupancy_level === 'high') high_occ_count++;
    });

    const avg_occupancy = active_buses > 0 ? (sum_occ / active_buses) : 0;

    res.json({
      active_buses,
      avg_occupancy,
      high_occupancy_count: high_occ_count
    });
  } catch (err) {
    console.error('Error obteniendo stats:', err);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// ─── GET /api/buses/lines ─────────────────────────────────
// Lista de líneas con info de próximo autobús y todas las líneas
router.get('/lines', async (req, res) => {
  try {
    const [buses, allLines] = await Promise.all([
      emtService.getBuses(),
      emtService.getAllLines()
    ]);
    
    // Group active buses by line
    const activeLinesMap = {};
    buses.forEach(b => {
      if (!activeLinesMap[b.line]) {
        activeLinesMap[b.line] = {
          line: b.line,
          destination: b.destination,
          eta: b.eta_minutes,
          occupancy_level: b.occupancy_level,
          occupancy_pct: b.occupancy_pct,
          line_color: b.line_color,
          count: 1,
          is_active: true
        };
      } else {
        activeLinesMap[b.line].count++;
        activeLinesMap[b.line].occupancy_pct += b.occupancy_pct;
        if (b.eta_minutes < activeLinesMap[b.line].eta) {
          activeLinesMap[b.line].eta = b.eta_minutes; // closest bus
        }
      }
    });

    const activeLines = Object.values(activeLinesMap).map(l => {
      l.occupancy_pct = l.occupancy_pct / l.count; // average occupancy
      delete l.count;
      return l;
    });

    // Merge active lines with all lines
    const mergedLines = allLines.map(lineInfo => {
      const activeLine = activeLines.find(l => l.line === lineInfo.line);
      if (activeLine) {
        return activeLine; // We prefer the live data if available
      } else {
        return {
          line: lineInfo.line,
          destination: lineInfo.nameB, // NameB is usually the destination
          eta: null,
          occupancy_level: 'none',
          occupancy_pct: 0,
          line_color: lineInfo.color,
          is_active: false
        };
      }
    });

    // Sort by: active first (by ETA), then inactive (by line name/number)
    mergedLines.sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      if (a.is_active && b.is_active) return a.eta - b.eta;
      return a.line.localeCompare(b.line, undefined, { numeric: true });
    });

    res.json(mergedLines);
  } catch (err) {
    console.error('Error obteniendo líneas:', err);
    res.status(500).json({ error: 'Error obteniendo líneas' });
  }
});

// ─── GET /api/buses/lines/:id/stops ─────────────────────
// Paradas de una línea específica
router.get('/lines/:id/stops', async (req, res) => {
  try {
    const stops = await emtService.getLineStops(req.params.id);
    res.json(stops);
  } catch (err) {
    console.error('Error obteniendo paradas de línea:', err);
    res.status(500).json({ error: 'Error obteniendo paradas de línea' });
  }
});

// ─── GET /api/buses/stops ────────────────────────────────
// Todas las paradas de Madrid con coordenadas
router.get('/stops', async (req, res) => {
  try {
    const stops = await emtService.getAllStops();
    res.json(stops);
  } catch (err) {
    console.error('Error obteniendo paradas:', err);
    res.status(500).json({ error: 'Error obteniendo paradas' });
  }
});

// ─── GET /api/buses/stops/:id/arrivals ───────────────────
// Llegadas en tiempo real a una parada específica
router.get('/stops/:id/arrivals', async (req, res) => {
  try {
    const arrivals = await emtService.getStopArrivals(req.params.id);
    res.json(arrivals);
  } catch (err) {
    console.error('Error obteniendo llegadas:', err);
    res.status(500).json({ error: 'Error obteniendo llegadas' });
  }
});

module.exports = router;
