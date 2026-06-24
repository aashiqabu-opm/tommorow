// Removes ALL demo data seeded by scripts/demo-seed.mjs. Idempotent.
// Demo accounts (@demo.invalid) are deleted via the auth admin API, which
// cascades public_profiles → talent_profiles + audition_submissions.
import fs from 'node:fs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const readEnv = (f) => Object.fromEntries(
  (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '').split('\n')
    .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
    .map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]))
const db = readEnv('.env.db'), app = readEnv('.env.local')

const sb = createClient(app.NEXT_PUBLIC_SUPABASE_URL, app.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const c = new pg.Client({ host: db.PGHOST, port: db.PGPORT, user: db.PGUSER, password: db.PGPASSWORD, database: db.PGDATABASE, ssl: { rejectUnauthorized: false } })

async function main() {
  await c.connect()
  const a = (await c.query("DELETE FROM attendance_logs WHERE crew_name LIKE '[DEMO]%'")).rowCount
  const g = (await c.query("DELETE FROM geofences WHERE name LIKE '[DEMO]%'")).rowCount
  const o = (await c.query("DELETE FROM open_calls WHERE role_title LIKE '[DEMO]%'")).rowCount  // cascades any remaining submissions
  await c.end()

  let users = 0
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith('@demo.invalid')) { await sb.auth.admin.deleteUser(u.id); users++ }
  }
  console.log(`REMOVED: ${users} demo account(s) (+ their talent profiles & submissions via cascade), ${g} geofence(s), ${a} attendance log(s), ${o} open call(s).`)
  console.log('Demo data cleared. Production is back to real data only.')
}
main().catch(e => { console.error('TEARDOWN ERROR:', e.message); process.exit(1) })
