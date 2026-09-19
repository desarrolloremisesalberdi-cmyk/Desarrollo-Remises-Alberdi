const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    // Agregar columna clave si no existe
    await pool.query(`
      ALTER TABLE choferes 
      ADD COLUMN IF NOT EXISTS clave VARCHAR(255);
    `);
    console.log('Columna clave agregada o ya existía.');

    // Insertar el chofer
    await pool.query(`
      INSERT INTO choferes (nombre, apellido, dni, clave, estado, numero_movil) 
      VALUES ('Chofer', 'Prueba', '31861718', '123456', 'inactivo', 1)
      ON CONFLICT DO NOTHING;
    `);
    console.log('Chofer insertado.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
