const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Installing pg driver temporarily...');
try {
  execSync('npm install pg --no-save', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to install pg:', e);
  process.exit(1);
}

const { Client } = require('pg');

// Read .env.db
const envDbPath = path.join(__dirname, '../.env.db');
if (!fs.existsSync(envDbPath)) {
  console.error('.env.db not found!');
  process.exit(1);
}

const envDbContent = fs.readFileSync(envDbPath, 'utf8');
const env = {};
envDbContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const client = new Client({
  host: env.PGHOST,
  port: parseInt(env.PGPORT || '5432'),
  user: env.PGUSER,
  password: env.PGPASSWORD,
  database: env.PGDATABASE,
  ssl: { rejectUnauthorized: false }
});

const migrationPath = path.join(__dirname, '../supabase/migration-archival-and-records.sql');
if (!fs.existsSync(migrationPath)) {
  console.error('Migration SQL file not found!');
  process.exit(1);
}
const sql = fs.readFileSync(migrationPath, 'utf8');

async function run() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Running migration-archival-and-records.sql...');
  try {
    await client.query(sql);
    console.log('Migration ran successfully!');
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
