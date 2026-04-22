// server/routes/suggestions.js
// Rutas de sugerencias/mensajes de usuarios

const express = require('express');
const { getPool, sql } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/suggestions ─────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    let query;
    const request = pool.request();

    if (req.user.role === 'gestor') {
      query = `
        SELECT s.*, u.display_name as user_name
        FROM suggestions s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
      `;
    } else {
      request.input('user_id', sql.Int, req.user.id);
      query = `
        SELECT s.*, u.display_name as user_name
        FROM suggestions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.user_id = @user_id
        ORDER BY s.created_at DESC
      `;
    }
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error obteniendo sugerencias:', err);
    res.status(500).json({ error: 'Error obteniendo sugerencias' });
  }
});

// ─── POST /api/suggestions ────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'El mensaje es requerido' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, req.user.id)
      .input('message', sql.NVarChar, message.trim())
      .query(`
        INSERT INTO suggestions (user_id, message, created_at)
        OUTPUT INSERTED.*
        VALUES (@user_id, @message, GETDATE())
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creando sugerencia:', err);
    res.status(500).json({ error: 'Error creando sugerencia' });
  }
});

// ─── PUT /api/suggestions/:id ─────────────────────────────
// Solo gestores pueden responder
router.put('/:id', authMiddleware, requireRole('gestor'), async (req, res) => {
  const { response } = req.body;
  if (!response) return res.status(400).json({ error: 'La respuesta es requerida' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('response', sql.NVarChar, response)
      .query(`
        UPDATE suggestions SET response = @response
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    if (result.recordset.length === 0) return res.status(404).json({ error: 'Sugerencia no encontrada' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error respondiendo sugerencia:', err);
    res.status(500).json({ error: 'Error respondiendo sugerencia' });
  }
});

module.exports = router;
