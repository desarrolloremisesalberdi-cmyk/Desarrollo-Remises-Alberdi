const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function insertTestData() {
  try {
    console.log('Inserting test data...');
    
    // Insert Passenger
    await pool.query(`
      INSERT INTO usuarios (id, nombre, apellido, telefono) 
      VALUES ('11111111-1111-1111-1111-111111111111', 'Marcos', 'Zanini', '3464552083')
      ON CONFLICT DO NOTHING;
    `);

    // Insert Driver
    await pool.query(`
      INSERT INTO choferes (id, nombre, apellido, dni, clave, vehiculo_modelo, vehiculo_patente)
      VALUES ('22222222-2222-2222-2222-222222222222', 'Prueba', 'Chofer', '31861718', '123456', 'Toyota Corolla', 'AB123CD')
      ON CONFLICT DO NOTHING;
    `);

    console.log('Test data inserted successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

insertTestData();
