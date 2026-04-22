// server/routes/auth.js
// Rutas de autenticación: login, registro, perfil

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─── POST /api/auth/register ─────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, display_name, role = 'pasajero' } = req.body;

  if (!email || !password || !display_name) {
    return res.status(400).json({ error: 'Email, contraseña y nombre son requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const validRoles = ['pasajero', 'conductor', 'gestor'];
  const safeRole = validRoles.includes(role) ? role : 'pasajero';

  try {
    const pool = await getPool();

    // Verificar si el email ya existe
    const existing = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM users WHERE email = @email');
    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'Este email ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, passwordHash)
      .input('display_name', sql.NVarChar, display_name)
      .input('role', sql.NVarChar, safeRole)
      .query(`
        INSERT INTO users (email, password_hash, display_name, role, created_at)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.display_name, INSERTED.role
        VALUES (@email, @password_hash, @display_name, @role, GETDATE())
      `);

    const user = result.recordset[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, display_name: user.display_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role } });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, email, password_hash, display_name, role, phone, avatar_url, assigned_line FROM users WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = result.recordset[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, display_name: user.display_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        phone: user.phone,
        avatar_url: user.avatar_url,
        assigned_line: user.assigned_line,
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT id, email, display_name, role, phone, avatar_url, assigned_line, created_at FROM users WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error en /me:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── PUT /api/auth/profile ────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  const { display_name, phone } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.user.id)
      .input('display_name', sql.NVarChar, display_name)
      .input('phone', sql.NVarChar, phone || null)
      .query('UPDATE users SET display_name = @display_name, phone = @phone, updated_at = GETDATE() WHERE id = @id');
    res.json({ message: 'Perfil actualizado correctamente' });
  } catch (err) {
    console.error('Error actualizando perfil:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
