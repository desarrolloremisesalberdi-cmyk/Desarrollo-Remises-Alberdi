const db = require('./backend/config/db');

async function migrate() {
  try {
    console.log('Creating destinos_fijos table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS destinos_fijos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        precio NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Adding columns to viajes...');
    await db.query(`
      ALTER TABLE viajes
      ADD COLUMN IF NOT EXISTS destino_fijo_id INTEGER REFERENCES destinos_fijos(id),
      ADD COLUMN IF NOT EXISTS costo_fijo NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS espera_minutos INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS costo_espera NUMERIC(10, 2) DEFAULT 0
    `);

    console.log('Adding columns to tarifas...');
    await db.query(`
      ALTER TABLE tarifas
      ADD COLUMN IF NOT EXISTS precio_espera_hora NUMERIC(10, 2) DEFAULT 0
    `);

    console.log('Migration complete.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    process.exit();
  }
}

migrate();
