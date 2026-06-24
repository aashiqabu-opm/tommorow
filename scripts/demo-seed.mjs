// Demo ecosystem seed — Auditions (talent accounts, open calls, submissions) +
// attendance/geofence. EVERYTHING is tagged so it is cleanly reversible:
//   - public accounts use @demo.invalid emails
//   - all other rows have a "[DEMO]" prefix
// Reset anytime with:  node scripts/demo-teardown.mjs
//
// Safe to re-run: it removes its own prior demo data first.
import fs from 'node:fs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const readEnv = (f) => Object.fromEntries(
  (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '').split('\n')
    .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
    .map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]))
const db = readEnv('.env.db'), app = readEnv('.env.local')

const OPS_PROJECT = 'ceb6cdf3-52d1-492c-9e09-8681f4cd1ec7' // OPM Office (ops)
const FILM = '49c70d26-bd67-4134-a45d-39f1d28029fb'        // Kaali (active)
const FOUNDER = 'd4aca2af-42d9-40c4-9763-3e80299a31f9'      // Aashiq Abu

const sb = createClient(app.NEXT_PUBLIC_SUPABASE_URL, app.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const c = new pg.Client({ host: db.PGHOST, port: db.PGPORT, user: db.PGUSER, password: db.PGPASSWORD, database: db.PGDATABASE, ssl: { rejectUnauthorized: false } })

const TALENT = [
  { email: 'demo.talent1@demo.invalid', name: '[DEMO] Asha Menon', category: 'actor', kind: 'talent' },
  { email: 'demo.talent2@demo.invalid', name: '[DEMO] Ravi Kumar', category: 'voice_artist', kind: 'talent' },
]

async function main() {
  await c.connect()

  // 0) idempotency — clear any prior demo rows first
  await c.query("DELETE FROM attendance_logs WHERE crew_name LIKE '[DEMO]%'")
  await c.query("DELETE FROM geofences WHERE name LIKE '[DEMO]%'")
  await c.query("DELETE FROM open_calls WHERE role_title LIKE '[DEMO]%'")
  const { data: existing } = await sb.auth.admin.listUsers({ perPage: 1000 })
  for (const u of existing?.users ?? []) if (u.email?.endsWith('@demo.invalid')) await sb.auth.admin.deleteUser(u.id)

  // 1) demo public/talent accounts (handle_new_user creates their public_profiles)
  const accounts = []
  for (const t of TALENT) {
    const { data, error } = await sb.auth.admin.createUser({
      email: t.email, password: 'demo-' + Math.random().toString(36).slice(2), email_confirm: true,
      user_metadata: { account_type: 'public', account_kind: t.kind, full_name: t.name },
    })
    if (error) throw new Error('createUser ' + t.email + ': ' + error.message)
    accounts.push({ ...t, id: data.user.id })
  }

  // 2) geofence on the OPM Office (the GPS check-in zone from the task)
  const gf = (await c.query(
    `INSERT INTO geofences (project_id, name, latitude, longitude, radius_m, active, notes, created_by)
     VALUES ($1,'[DEMO] OPM Office Zone',9.9667,76.3088,150,true,'[DEMO] DLF Riverside, Vyttila',$2) RETURNING id`,
    [OPS_PROJECT, FOUNDER])).rows[0].id

  // 3) attendance — one GPS check-in INSIDE the radius, one manual
  await c.query(
    `INSERT INTO attendance_logs (project_id, crew_name, geofence_id, log_date, check_in_at, method, consent_ok, latitude, longitude, created_by)
     VALUES ($1,'[DEMO] Subin',$2,CURRENT_DATE, now() - interval '2 hours','geofence',true,9.9670,76.3090,$3)`,
    [OPS_PROJECT, gf, FOUNDER])
  await c.query(
    `INSERT INTO attendance_logs (project_id, crew_name, geofence_id, log_date, check_in_at, check_out_at, method, consent_ok, created_by)
     VALUES ($1,'[DEMO] Maya R',$2,CURRENT_DATE, now() - interval '3 hours', now(),'manual',false,$3)`,
    [OPS_PROJECT, gf, FOUNDER])

  // 4) open casting calls + 5) submissions from the demo talent
  const callA = (await c.query(
    `INSERT INTO open_calls (project_id, role_title, category, description, status, created_by)
     VALUES ($1,'[DEMO] Lead Antagonist (M, 30-40)','actor','[DEMO] Intense supporting lead.','open',$2) RETURNING id`,
    [FILM, FOUNDER])).rows[0].id
  const callB = (await c.query(
    `INSERT INTO open_calls (project_id, role_title, category, description, status, created_by)
     VALUES ($1,'[DEMO] Playback / Voice Artist','voice_artist','[DEMO] Malayalam voice for promos.','open',$2) RETURNING id`,
    [FILM, FOUNDER])).rows[0].id

  for (const a of accounts) {
    await c.query(
      `INSERT INTO talent_profiles (account_id, category, stage_name, bio, languages, skills, location, available)
       VALUES ($1,$2,$3,'[DEMO] sample talent profile', ARRAY['Malayalam','English'], ARRAY['screen acting'],'Kochi',true)`,
      [a.id, a.category, a.name.replace('[DEMO] ', '')])
    await c.query(
      `INSERT INTO audition_submissions (account_id, open_call_id, self_tape_ref, note, status)
       VALUES ($1,$2,'demo://self-tape','[DEMO] self-tape submission','submitted')`,
      [a.id, a.category === 'voice_artist' ? callB : callA])
  }

  const cnt = async (t) => (await c.query(`select count(*)::int n from ${t} where ${t==='attendance_logs'?"crew_name":t==='geofences'?"name":t==='open_calls'?"role_title":"true"}${t==='audition_submissions'||t==='talent_profiles'?'':" LIKE '[DEMO]%'"}`)).rows[0]?.n
  console.log('SEEDED:')
  console.log('  demo accounts:', accounts.length, '(public_profiles auto-created)')
  console.log('  geofences:', await cnt('geofences'), '| attendance_logs:', await cnt('attendance_logs'), '| open_calls:', await cnt('open_calls'))
  const tp = (await c.query("select count(*)::int n from talent_profiles")).rows[0].n
  const as = (await c.query("select count(*)::int n from audition_submissions")).rows[0].n
  console.log('  talent_profiles:', tp, '| audition_submissions:', as)
  await c.end()
  console.log('\nReset later with:  node scripts/demo-teardown.mjs')
}
main().catch(e => { console.error('SEED ERROR:', e.message); process.exit(1) })
