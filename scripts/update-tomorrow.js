const fs = require('fs');
const path = require('path');
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

async function run() {
  console.log('Connecting to database...');
  await client.connect();
  
  console.log('Updating TOMORROW project info...');
  const projectSql = `
    UPDATE projects 
    SET 
      production_company = 'Tomorrow Smartcity Ventures Pvt Ltd', 
      description = 'Real estate project under Tomorrow Smartcity Ventures Pvt Ltd. Founder & Chairman: Aashiq Abu. Separate company run by OPM.' 
    WHERE slug = 'tomorrow';
  `;
  try {
    const res = await client.query(projectSql);
    console.log('Update successful, rows affected:', res.rowCount);
  } catch (err) {
    console.error('Error running update on project:', err);
  }

  console.log('Checking bank accounts...');
  try {
    const checkRes = await client.query('SELECT count(*)::int as count FROM bank_accounts;');
    const count = checkRes.rows[0].count;
    console.log('Current bank account count:', count);
    
    if (count === 0) {
      console.log('Seeding default bank accounts...');
      const seedSql = `
        INSERT INTO bank_accounts (name, account_type, account_number, ifsc, opening_balance, current_balance, is_active) VALUES
          ('OPM Cinemas Proprietorship (Federal Bank)', 'bank', '12340500001111', 'FDRL0001234', 1000000.00, 1000000.00, TRUE),
          ('OPM Dream Mill Cinemas PVT LTD (HDFC Bank)', 'bank', '50200011112222', 'HDFC0002222', 2500000.00, 2500000.00, TRUE),
          ('Tomorrow Smartcity Ventures Pvt Ltd (Federal Bank)', 'bank', '12340500003333', 'FDRL0001234', 5000000.00, 5000000.00, TRUE);
      `;
      const seedRes = await client.query(seedSql);
      console.log('Successfully seeded bank accounts. Rows inserted:', seedRes.rowCount);
    } else {
      // Check if Tomorrow Smartcity bank account already exists
      const tomAccCheck = await client.query("SELECT * FROM bank_accounts WHERE name LIKE '%Tomorrow Smartcity%';");
      if (tomAccCheck.rows.length === 0) {
        console.log('Adding Tomorrow Smartcity bank account...');
        const addSql = `
          INSERT INTO bank_accounts (name, account_type, account_number, ifsc, opening_balance, current_balance, is_active) VALUES
            ('Tomorrow Smartcity Ventures Pvt Ltd (Federal Bank)', 'bank', '12340500003333', 'FDRL0001234', 5000000.00, 5000000.00, TRUE);
        `;
        const addRes = await client.query(addSql);
        console.log('Successfully added Tomorrow Smartcity bank account.');
      } else {
        console.log('Tomorrow Smartcity bank account already exists.');
      }
    }
  } catch (err) {
    console.error('Error seeding bank accounts:', err);
  } finally {
    await client.end();
  }
}

run();
