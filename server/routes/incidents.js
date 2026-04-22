// server/routes/incidents.js
// Rutas de incidencias

const express = require('express');
const { getPool, sql } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/incidents ───────────────────────────────────
// Gestor: todas | Conductor/Pasajero: solo las suyas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    let query;
    const request = pool.request();

    if (req.user.role === 'gestor') {
      query = `
        SELECT i.*, u.display_name as user_name
        FROM incidents i
        LEFT JOIN users u ON i.user_id = u.id
        ORDER BY i.created_at DESC
      `;
    } else {
      request.input('user_id', sql.Int, req.user.id);
      query = `
        SELECT i.*, u.display_name as user_name
        FROM incidents i
        LEFT JOIN users u ON i.user_id = u.id
        WHERE i.user_id = @user_id
        ORDER BY i.created_at DESC
      `;
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error obteniendo incidencias:', err);
    res.status(500).json({ error: 'Error obteniendo incidencias' });
  }
});

// ─── POST /api/incidents ──────────────────────────────────
// Conductor o pasajero crean una incidencia
router.post('/', authMiddleware, async (req, res) => {
  const { type, title, description, line } = req.body;

  if (!type || !title) {
    return res.status(400).json({ error: 'Tipo y título son requeridos' });
  }
  const validTypes = ['normal', 'urgencia', 'refuerzo'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Tipo de incidencia inválido' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, req.user.id)
      .input('type', sql.NVarChar, type)
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description || null)
      .input('line', sql.NVarChar, line || null)
      .query(`
        INSERT INTO incidents (user_id, type, title, description, line, status, created_at, updated_at)
        OUTPUT INSERTED.*
        VALUES (@user_id, @type, @title, @description, @line, 'abierta', GETDATE(), GETDATE())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creando incidencia:', err);
    res.status(500).json({ error: 'Error creando incidencia' });
  }
});

// ─── PUT /api/incidents/:id ───────────────────────────────
// Solo gestores pueden actualizar el estado
router.put('/:id', authMiddleware, requireRole('gestor'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['abierta', 'en_proceso', 'resuelta'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE incidents
        SET status = @status, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Incidencia no encontrada' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error actualizando incidencia:', err);
    res.status(500).json({ error: 'Error actualizando incidencia' });
  }
});

module.exports = router;
