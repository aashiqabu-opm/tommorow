# OPM Flash — Backup & Disaster Recovery Runbook

**Scope:** the Supabase Postgres project that holds the entire company's financial,
production, and legal records (project ref `skarxqynijdnnwowsopg`), plus the three
Storage buckets (`documents`, `personal`, `vehicle-documents` — all private).

**Owner:** Founder (Aashiq Abu). **Maintainer:** whoever holds Claude Code / DB access.

> ⚠️ This database is the single source of truth for OPM's money and contracts.
> Backups are only real once a **restore has been tested**. Do the quarterly drill.

---

## 1. Targets (RPO / RTO)

| Metric | Target | How it's met |
|---|---|---|
| **RPO** (max data loss) | **≤ 5 minutes** | Supabase PITR (continuous WAL) once enabled; falls back to **≤ 24 h** on daily logical dumps if PITR is off |
| **RTO** (time to restore service) | **≤ 4 hours** | PITR restore to a new project / branch, or `pg_restore` of the latest dump |
| **Off-platform copy** | **weekly** | Manual `pg_dump` stored outside Supabase (encrypted) |
| **Storage buckets** | **weekly** | Bucket export (CLI) alongside the DB dump |

These assume the Supabase **Pro** plan (or higher). PITR is an add-on; see §2.

---

## 2. Supabase PITR — setup (one-time)

PITR (Point-In-Time Recovery) gives continuous, minute-level recovery and is the
primary backup mechanism.

1. **Plan:** ensure the project is on **Pro** (₹ ~$25/mo) or above. PITR is a paid
   **add-on** on top of Pro — daily backups come with Pro; PITR (1–7+ day window)
   is enabled separately.
2. In the Supabase Dashboard → **Project Settings → Add-ons → Point-in-Time Recovery** → enable (start with the **7-day** window).
3. Confirm under **Database → Backups** that "Point in Time" shows an active window.
4. Record the enablement date here: `PITR enabled on: __________`.

**Daily automated backups** (included on Pro) require no setup; verify they appear
under **Database → Backups → Scheduled**.

---

## 3. Manual `pg_dump` (weekly off-platform copy)

Run from a machine with `pg_dump` (Postgres client tools). Credentials live in the
gitignored `.env.db` (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE).

```bash
# Load DB creds (never commit these)
set -a; source .env.db; set +a

# Full logical dump (custom format, compressed) — schema + data
STAMP=$(date +%Y%m%d_%H%M%S)
PGPASSWORD="$PGPASSWORD" pg_dump \
  --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="$PGDATABASE" \
  --no-owner --no-privileges --format=custom \
  --file="opm-office_${STAMP}.dump"

# (Optional) plain-SQL dump for human-readable diffing
PGPASSWORD="$PGPASSWORD" pg_dump --host="$PGHOST" --port="$PGPORT" \
  --username="$PGUSER" --dbname="$PGDATABASE" --no-owner --no-privileges \
  --format=plain --file="opm-office_${STAMP}.sql"

# Encrypt before moving off-machine (use a known passphrase stored in the vault)
gpg --symmetric --cipher-algo AES256 "opm-office_${STAMP}.dump"
# → store opm-office_${STAMP}.dump.gpg in the off-platform location (see §6)
rm "opm-office_${STAMP}.dump" "opm-office_${STAMP}.sql"   # remove plaintext copies
```

**Storage buckets** (run alongside): using the Supabase CLI logged into the project,
```bash
supabase storage cp --recursive ss://documents ./storage-backup/documents
supabase storage cp --recursive ss://personal ./storage-backup/personal
supabase storage cp --recursive ss://vehicle-documents ./storage-backup/vehicle-documents
# then tar + gpg the storage-backup/ folder into the same off-platform location
```

> Note: there is **no `psql`/`pg_dump` on the primary dev Mac** today — install
> Postgres client tools (`brew install libpq` → add to PATH) or run the dump from
> any machine/CI that has them. The app's own migrations use the `pg` node client,
> which is **not** a backup tool.

---

## 4. Restore — step by step

### 4a. PITR restore (preferred — minimal data loss)
1. Supabase Dashboard → **Database → Backups → Point in Time**.
2. Pick the target timestamp (just **before** the incident).
3. Choose **Restore** → Supabase provisions the recovered state (to the same project
   or a new one, per the dialog). **This is destructive to current data on the same
   project** — prefer restoring to a **new project / branch** first, verify, then cut over.
4. Update the app's `SUPABASE_*` env vars (Vercel + local `.env.local`) if the
   project ref changed; redeploy.
5. Re-point Storage if buckets were affected (PITR covers the DB; bucket objects are
   restored from §3 copies).

### 4b. Logical-dump restore (from a `pg_dump` file)
```bash
set -a; source .env.db; set +a   # or the NEW target project's creds
gpg --decrypt opm-office_YYYYMMDD_HHMMSS.dump.gpg > restore.dump

# Restore into a clean target database
PGPASSWORD="$PGPASSWORD" pg_restore \
  --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="$PGDATABASE" \
  --no-owner --no-privileges --clean --if-exists --jobs=4 restore.dump
```
Then re-create RLS-helper functions / extensions only if the target was empty (the
custom dump includes them). Verify table count and RLS (see §5).

### 4c. Post-restore verification (always)
```sql
select count(*) from information_schema.tables where table_schema='public';   -- expect ~122
select count(*) from pg_policy;                                                -- expect ~331
select relname from pg_class where relkind='r' and relnamespace='public'::regnamespace and relrowsecurity=false;  -- expect 0 rows
select id, public from storage.buckets;   -- documents/personal/vehicle-documents all public=false
```
Then smoke-test the app: log in, open a payment with a bill (signed URL), view a film P&L.

---

## 5. Quarterly DR drill — checklist

Run once per quarter; log the result at the bottom.

- [ ] Trigger a **PITR restore to a NEW throwaway project** (do not touch prod).
- [ ] Run the §4c verification queries — table count, policy count, 0 tables w/o RLS, buckets private.
- [ ] Point a local dev build at the restored project; confirm login + 3 critical reads (payment bill, Film P&L, receivables).
- [ ] Restore the latest **`pg_dump`** into a local Postgres; confirm it loads clean.
- [ ] Confirm the off-platform encrypted copy **decrypts** (`gpg --decrypt`) and is < 8 days old.
- [ ] Time the whole exercise — confirm under the **4-hour RTO**.
- [ ] Delete the throwaway project; record outcome below.
- [ ] Rotate the dump-encryption passphrase if anyone with access has left.

**Drill log:** `YYYY-MM-DD — performed by ____ — RTO observed ____ — notes ____`

---

## 6. Off-platform storage location

Backups must live **outside Supabase** (a Supabase-side incident must not take the
backups with it). Use ONE of:
- A dedicated cloud bucket on a different provider (e.g. Google Drive / R2 / S3) under the founder's control, **encrypted** (§3).
- An encrypted external drive held by the founder.

Record the chosen location + who has access: `Location: ______  Access: ______`.

---

## 7. Disaster contact chain (who to call, in order)

Fill in real numbers and keep this current. Call in sequence until someone responds.

1. **Founder — Aashiq Abu** (owns the project, all keys). `phone: ____________`
2. **Maintainer / engineer on call** (Claude Code + DB access). `phone: ____________`
3. **Accountant — Shiny** (confirms financial-data integrity post-restore). `phone: ____________`
4. **General Manager — Madan AVK** (ops coordination, staff comms). `phone: ____________`
5. **Supabase support** (Pro plan → dashboard support; for PITR/restore help). Project ref `skarxqynijdnnwowsopg`.
6. **Vercel support** (if the outage is hosting, not data).

**Incident roles:** Founder = decision-maker / go-no-go on cutover. Engineer =
executes restore. Accountant = verifies money figures match last-known-good.

---

## 8. What is and isn't covered

- **Covered:** all 122 Postgres tables (data + schema + RLS + functions), via PITR and logical dumps; Storage objects via weekly bucket export.
- **NOT covered by Supabase backups:** application **secrets** (Anthropic key, Gmail app password, service-role key, CRON_SECRET) — these live in Vercel env + `.env*`; keep a separate **encrypted secret inventory** (see `SECRETS.md`) and a rotation log.
- **Code:** GitHub is the backup for code; `main` is the source of truth. A migration's SQL file in `supabase/` is the record of every schema change.

---

*Last reviewed: 2026-06-22. Review this runbook at each quarterly drill.*
