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
      status = 'development',
      budget = 2000000000,
      description = 'Real estate project under Tomorrow Smartcity Ventures Pvt Ltd. Founder & Chairman: Aashiq Abu. Currently under planning (200 Crore budget). Active members/consultants: Designers, Contractors, KPMG. Needs funding to move forward; negotiations are ongoing. Aashiq Abu has already spent personal capital on early-stage development.' 
    WHERE slug = 'tomorrow';
  `;
  try {
    const res = await client.query(projectSql);
    console.log('Update successful, rows affected:', res.rowCount);
  } catch (err) {
    console.error('Error running update on project:', err);
  }

  // Get project ID for tomorrow
  let projectId = '';
  try {
    const idRes = await client.query("SELECT id FROM projects WHERE slug = 'tomorrow';");
    if (idRes.rows.length > 0) {
      projectId = idRes.rows[0].id;
    }
  } catch (err) {
    console.error('Error getting project ID:', err);
  }

  if (projectId) {
    console.log('Checking project funding for tomorrow...');
    try {
      const checkRes = await client.query('SELECT count(*)::int as count FROM project_funding WHERE project_id = $1;', [projectId]);
      const count = checkRes.rows[0].count;
      console.log('Current project funding count for tomorrow:', count);
      
      if (count === 0) {
        console.log('Seeding initial project funding by Aashiq Abu...');
        const fundRes = await client.query(`
          INSERT INTO project_funding (project_id, kind, name, amount, status, notes) 
          VALUES ($1, 'opm', 'Aashiq Abu (Initial Capital)', 5000000.00, 'active', 'Initial capital spent by founder Aashiq Abu for planning and early development. Active negotiations for further funding.')
          RETURNING id;
        `, [projectId]);
        
        const fundingId = fundRes.rows[0].id;
        console.log('Successfully seeded project funding record:', fundingId);

        // Insert transaction
        await client.query(`
          INSERT INTO funding_transactions (funding_id, txn_date, type, amount, notes) 
          VALUES ($1, '2026-06-10', 'capital_in', 5000000.00, 'Initial capital in');
        `, [fundingId]);
        console.log('Successfully seeded capital in transaction.');
      } else {
        console.log('Project funding already exists for tomorrow.');
      }
    } catch (err) {
      console.error('Error seeding project funding:', err);
    }
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
