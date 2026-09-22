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

    // Insertar o actualizar el chofer Juan Pérez (DNI 25487123)
    const res = await pool.query("SELECT id FROM choferes WHERE dni = '25487123'");
    if (res.rows.length > 0) {
      await pool.query("UPDATE choferes SET clave = '123456', nombre = 'Juan', apellido = 'Pérez', numero_movil = 14 WHERE dni = '25487123'");
    } else {
      await pool.query("INSERT INTO choferes (nombre, apellido, dni, clave, estado, numero_movil) VALUES ('Juan', 'Pérez', '25487123', '123456', 'inactivo', 14)");
    }
    console.log('Chofer Juan Pérez insertado/actualizado con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
