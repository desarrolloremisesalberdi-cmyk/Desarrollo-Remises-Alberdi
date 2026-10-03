const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.yujrdronijgsffyvwkey:Innovacion2026%21@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });
async function setupDB() {
  try {
    // Add precio_km_extra if not exists
    try {
      await pool.query('ALTER TABLE tarifas ADD COLUMN precio_km_extra DECIMAL(10,2) DEFAULT 1100');
    } catch(e) { console.log('Column might already exist:', e.message); }
    
    // Update tarifas
    const queryTarifas = `
      INSERT INTO tarifas (id, bajada_bandera_diurna, precio_100m_diurna, bajada_bandera_jubilados, precio_100m_jubilados, bajada_bandera_nocturna, precio_100m_nocturna, precio_espera_hora, precio_km_extra)
      VALUES (1, 2800, 140, 2200, 110, 3100, 150, 14000, 1100)
      ON CONFLICT (id) DO UPDATE SET
        bajada_bandera_diurna = EXCLUDED.bajada_bandera_diurna,
        precio_100m_diurna = EXCLUDED.precio_100m_diurna,
        bajada_bandera_jubilados = EXCLUDED.bajada_bandera_jubilados,
        precio_100m_jubilados = EXCLUDED.precio_100m_jubilados,
        bajada_bandera_nocturna = EXCLUDED.bajada_bandera_nocturna,
        precio_100m_nocturna = EXCLUDED.precio_100m_nocturna,
        precio_espera_hora = EXCLUDED.precio_espera_hora,
        precio_km_extra = EXCLUDED.precio_km_extra
    `;
    await pool.query(queryTarifas);

    // Clear old destinos
    await pool.query('DELETE FROM destinos_fijos');

    // Insert new destinos
    const destinos = [
      ['Fuentes', 26000],
      ['Sanford', 26000],
      ['Los Molinos', 26000],
      ['Pujato', 26000],
      ['Arequito', 39000],
      ['Coronel Arnold', 39000],
      ['Carcaraña', 39000],
      ['Chabas', 39000],
      ['Zavalla', 39000],
      ['Rosario', 66000],
      ['Cañada de Gomez', 66000],
      ['Firmat', 66000],
      ['San Jose de la Esquina', 66000],
      ['Bigand', 66000]
    ];
    for (let d of destinos) {
      await pool.query('INSERT INTO destinos_fijos (nombre_destino, precio_fijo) VALUES ($1, $2)', [d[0], d[1]]);
    }
    console.log('Database seeded successfully');
    process.exit(0);
  } catch(e) { console.error(e); process.exit(1); }
}
setupDB();
