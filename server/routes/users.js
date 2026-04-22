// server/routes/users.js
// Rutas de gestión de usuarios (solo gestor)

const express = require('express');
const { getPool, sql } = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/users ───────────────────────────────────────
router.get('/', authMiddleware, requireRole('gestor'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id, email, display_name, role, phone, assigned_line, created_at,
             CASE WHEN last_login > DATEADD(hour, -8, GETDATE()) THEN 'activo' ELSE 'inactivo' END as status
      FROM users
      ORDER BY role, display_name
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error obteniendo usuarios:', err);
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

// ─── PUT /api/users/:id/role ──────────────────────────────
router.put('/:id/role', authMiddleware, requireRole('gestor'), async (req, res) => {
  const { role } = req.body;
  const validRoles = ['pasajero', 'conductor', 'gestor'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Rol inválido' });

  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('role', sql.NVarChar, role)
      .query('UPDATE users SET role = @role, updated_at = GETDATE() WHERE id = @id');
    res.json({ message: 'Rol actualizado' });
  } catch (err) {
    console.error('Error actualizando rol:', err);
    res.status(500).json({ error: 'Error actualizando rol' });
  }
});

// ─── PUT /api/users/:id/line ──────────────────────────────
router.put('/:id/line', authMiddleware, requireRole('gestor'), async (req, res) => {
  const { assigned_line } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('line', sql.NVarChar, assigned_line || null)
      .query('UPDATE users SET assigned_line = @line, updated_at = GETDATE() WHERE id = @id');
    res.json({ message: 'Línea asignada actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando línea' });
  }
});

module.exports = router;
