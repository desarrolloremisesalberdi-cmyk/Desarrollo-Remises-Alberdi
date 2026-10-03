const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.yujrdronijgsffyvwkey:Innovacion2026%21@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    // 1. Update tarifas
    await pool.query('ALTER TABLE tarifas ADD COLUMN IF NOT EXISTS precio_espera_hora DECIMAL(10, 2) DEFAULT 14000.00');
    console.log('tarifas updated');
    
    // 2. Update viajes
    await pool.query('ALTER TABLE viajes ADD COLUMN IF NOT EXISTS espera_minutos INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE viajes ADD COLUMN IF NOT EXISTS costo_espera DECIMAL(10, 2) DEFAULT 0.00');
    await pool.query('ALTER TABLE viajes ADD COLUMN IF NOT EXISTS requiere_cierre_manual BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE viajes ADD COLUMN IF NOT EXISTS destino_fijo_id INTEGER NULL');
    await pool.query('ALTER TABLE viajes ADD COLUMN IF NOT EXISTS costo_fijo DECIMAL(10, 2) NULL');
    console.log('viajes updated');

    // 3. Create destinos_fijos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS destinos_fijos (
        id SERIAL PRIMARY KEY,
        nombre_destino VARCHAR(255) NOT NULL,
        precio_fijo DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('destinos_fijos created');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
