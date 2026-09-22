const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Coordenadas base en Casilda
const CASILDA_LAT = -33.044167;
const CASILDA_LNG = -61.168056;

// Función para generar un pequeño offset aleatorio (para esparcirlos por Casilda)
function getRandomOffset() {
  return (Math.random() - 0.5) * 0.02; // Aprox +/- 1km
}

async function run() {
  try {
    // 1. Asegurar que existan las columnas lat y lng
    await pool.query(`
      ALTER TABLE choferes 
      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
    `);
    console.log('Columnas lat, lng e is_online aseguradas en la tabla choferes.');

    // 2. Sembrar al chofer específico solicitado por el usuario
    const latPrincipal = CASILDA_LAT + getRandomOffset();
    const lngPrincipal = CASILDA_LNG + getRandomOffset();
    
    let res = await pool.query("SELECT id FROM choferes WHERE dni = '31861718'");
    if (res.rows.length > 0) {
      await pool.query("UPDATE choferes SET clave = '123456', estado = 'libre', lat = $1, lng = $2, is_online = true WHERE dni = '31861718'", [latPrincipal, lngPrincipal]);
    } else {
      await pool.query("INSERT INTO choferes (nombre, apellido, dni, clave, estado, numero_movil, lat, lng, is_online) VALUES ('Chofer', 'Principal', '31861718', '123456', 'libre', 1, $1, $2, true)", [latPrincipal, lngPrincipal]);
    }
    console.log('Chofer principal (DNI 31861718) insertado/actualizado.');

    // 3. Sembrar 9 choferes adicionales
    for (let i = 2; i <= 10; i++) {
      const lat = CASILDA_LAT + getRandomOffset();
      const lng = CASILDA_LNG + getRandomOffset();
      const dniMock = `1000000${i}`;
      
      const isOnline = i % 2 !== 0; 
      const estado = isOnline ? 'libre' : 'ocupado';

      const check = await pool.query("SELECT id FROM choferes WHERE dni = $1", [dniMock]);
      if (check.rows.length > 0) {
        await pool.query("UPDATE choferes SET estado = $1, lat = $2, lng = $3, is_online = $4 WHERE dni = $5", [estado, lat, lng, isOnline, dniMock]);
      } else {
        await pool.query("INSERT INTO choferes (nombre, apellido, dni, clave, estado, numero_movil, lat, lng, is_online) VALUES ($1, $2, $3, '123456', $4, $5, $6, $7, $8)", [`Chofer`, `Prueba ${i}`, dniMock, estado, i, lat, lng, isOnline]);
      }
    }
    
    console.log('9 choferes de prueba adicionales insertados con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('Error sembrando choferes:', err);
    process.exit(1);
  }
}

run();
