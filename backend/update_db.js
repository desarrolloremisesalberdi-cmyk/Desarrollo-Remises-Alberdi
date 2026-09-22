const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateSchema() {
  try {
    console.log('Connecting to DB to alter tables...');
    
    // Añadir es_jubilado a usuarios
    await pool.query(`ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS es_jubilado BOOLEAN DEFAULT false;`);
    
    // Añadir nuevos campos a viajes
    await pool.query(`ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS comision_admin DECIMAL(10, 2);`);
    await pool.query(`ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS distancia_km DECIMAL(10, 2);`);
    await pool.query(`ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS hora_inicio TIMESTAMP WITH TIME ZONE;`);
    await pool.query(`ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS hora_fin TIMESTAMP WITH TIME ZONE;`);
    
    // Crear tabla de tarifas si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.tarifas (
          id SERIAL PRIMARY KEY,
          bajada_bandera_diurna DECIMAL(10, 2) NOT NULL,
          precio_100m_diurna DECIMAL(10, 2) NOT NULL,
          bajada_bandera_jubilados DECIMAL(10, 2) NOT NULL,
          precio_100m_jubilados DECIMAL(10, 2) NOT NULL,
          bajada_bandera_nocturna DECIMAL(10, 2) NOT NULL,
          precio_100m_nocturna DECIMAL(10, 2) NOT NULL,
          porcentaje_comision_agencia DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    
    // Insertar la tarifa inicial de la ordenanza de Casilda
    // Bajada diurna 2800, ficha diurna 140
    // Bajada jub 2200, ficha jub 110
    // Bajada nocturna 3100, ficha nocturna 150
    // Comision agencia 15% (default temporal)
    await pool.query(`
      INSERT INTO public.tarifas (
        bajada_bandera_diurna, precio_100m_diurna,
        bajada_bandera_jubilados, precio_100m_jubilados,
        bajada_bandera_nocturna, precio_100m_nocturna,
        porcentaje_comision_agencia
      ) SELECT 2800, 140, 2200, 110, 3100, 150, 15.00
      WHERE NOT EXISTS (SELECT 1 FROM public.tarifas LIMIT 1);
    `);
    
    console.log('Database schema updated successfully!');
  } catch (err) {
    console.error('Error altering tables:', err);
  } finally {
    await pool.end();
  }
}

updateSchema();
