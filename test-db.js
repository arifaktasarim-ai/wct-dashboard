require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function test() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS server_time
    `);

    console.log('=================================');
    console.log('SUPABASE BAGLANTISI BASARILI');
    console.log('=================================');
    console.log('Database:', result.rows[0].database);
    console.log('User:', result.rows[0].user);
    console.log('Server time:', result.rows[0].server_time);
    console.log('=================================');
  } catch (error) {
    console.error('=================================');
    console.error('SUPABASE BAGLANTI HATASI');
    console.error('=================================');
    console.error(error.message);
  } finally {
    await pool.end();
  }
}

test();