const db = require('./config/db');

async function updateDb() {
  try {
    console.log('Agregando columna requiere_cierre_manual a viajes...');
    await db.query(`ALTER TABLE public.viajes ADD COLUMN IF NOT EXISTS requiere_cierre_manual BOOLEAN DEFAULT FALSE;`);
    console.log('Update de DB completado.');
    process.exit(0);
  } catch (err) {
    console.error('Error actualizando DB:', err);
    process.exit(1);
  }
}

updateDb();
