import pkg from 'pg';
const { Client } = pkg;
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log('Testing SQL with Admin User...');
  console.log('Host:', process.env.SQL_HOST);
  console.log('User:', process.env.SQL_ADMIN_USER);
  
  const connectionString = `postgres://${process.env.SQL_USER}:${process.env.SQL_PASSWORD}@/${process.env.SQL_DB_NAME}?host=${process.env.SQL_HOST}`;
  console.log('Connecting with string:', connectionString.replace(process.env.SQL_PASSWORD, '****'));
  
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('  SUCCESS! Connected to postgres');
    const res = await client.query('SELECT datname FROM pg_database');
    console.log('  Databases:', res.rows.map(r => r.datname));
  } catch (err) {
    console.log('  FAIL:', err.message);
  } finally {
    await client.end();
  }
}

test();
