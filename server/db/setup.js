// server/db/setup.js
// Script para ejecutar el schema SQL en Azure SQL
// Uso: node server/db/setup.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../config/db');

async function setup() {
  console.log('🚀 Iniciando configuración de base de datos Azure SQL...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Dividir por "GO" o por sentencias individuales
  const statements = schemaSql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  try {
    const pool = await getPool();
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.request().query(statement);
          console.log('  ✅', statement.substring(0, 60).replace(/\n/g, ' ') + '...');
        } catch (err) {
          if (err.message.includes('already exists') || err.message.includes('There is already')) {
            console.log('  ⚠️  Ya existe:', statement.substring(0, 60).replace(/\n/g, ' ') + '...');
          } else {
            console.error('  ❌ Error:', err.message);
          }
        }
      }
    }
    console.log('\n✅ Setup completado exitosamente');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    process.exit(1);
  }
}

setup();
