const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.yujrdronijgsffyvwkey:Innovacion2026%21@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });
pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usuarios'`).then(res => console.log(res.rows)).catch(console.error).finally(() => pool.end());
