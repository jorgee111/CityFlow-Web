// server/routes/buses.js
// Rutas de autobuses: datos en tiempo real (simulados con demo data)

const express = require('express');
const { getPool, sql } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/buses ───────────────────────────────────────
// Devuelve todos los autobuses activos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM buses WHERE is_active = 1 ORDER BY line');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error obteniendo buses:', err);
    res.status(500).json({ error: 'Error obteniendo datos de buses' });
  }
});

// ─── GET /api/buses/stats ─────────────────────────────────
// Estadísticas agregadas para el dashboard
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as active_buses,
        AVG(CAST(occupancy_pct AS FLOAT)) as avg_occupancy,
        SUM(CASE WHEN occupancy_level = 'high' THEN 1 ELSE 0 END) as high_occupancy_count
      FROM buses WHERE is_active = 1
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error obteniendo stats:', err);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// ─── GET /api/buses/lines ─────────────────────────────────
// Lista de líneas con info de próximo autobús
router.get('/lines', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT line, destination,
        MIN(eta_minutes) as eta,
        occupancy_level,
        AVG(CAST(occupancy_pct AS FLOAT)) as occupancy_pct,
        line_color
      FROM buses
      WHERE is_active = 1
      GROUP BY line, destination, occupancy_level, line_color
      ORDER BY eta
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error obteniendo líneas:', err);
    res.status(500).json({ error: 'Error obteniendo líneas' });
  }
});

module.exports = router;
