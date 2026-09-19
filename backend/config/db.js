require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error conectando a Supabase (PostgreSQL):', err.stack);
  } else {
    console.log('Conexión exitosa a Supabase!');
  }
  if (release) release();
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
