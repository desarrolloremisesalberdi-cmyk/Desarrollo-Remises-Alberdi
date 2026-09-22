require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await pool.query('ALTER TABLE choferes ADD COLUMN IF NOT EXISTS foto_url TEXT;');
    await pool.query("UPDATE choferes SET foto_url = 'https://i.pravatar.cc/150?u=' || id::text;");
    console.log('Database updated successfully');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
