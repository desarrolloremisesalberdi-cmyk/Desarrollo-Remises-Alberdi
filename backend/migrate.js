const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.yujrdronijgsffyvwkey:Innovacion2026%21@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE usuarios 
      ADD COLUMN IF NOT EXISTS dni VARCHAR(50) UNIQUE,
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS clave VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
    `);
    console.log('Columns added successfully.');
  } catch (err) {
    console.error('Error adding columns', err);
  } finally {
    pool.end();
  }
}

migrate();
