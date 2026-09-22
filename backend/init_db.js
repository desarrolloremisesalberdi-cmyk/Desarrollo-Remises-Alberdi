const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runSchema() {
  try {
    const schemaSql = fs.readFileSync('schema.sql', 'utf8');
    console.log('Connecting to new DB and creating tables...');
    await pool.query(schemaSql);
    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await pool.end();
  }
}

runSchema();
