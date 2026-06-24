-- ───────────────────────────────────────────────────────────────────────
-- OPM Account RLS wall test. Proves a public account (no profiles row) is
-- denied ALL internal data. Run as the postgres role; SET ROLE authenticated
-- makes RLS apply. Every count below must be 0 (or permission-denied) — that is
-- the wall holding. The same tables hold real rows for the service role, so 0
-- here is meaningful, not an empty-table artefact.
-- ───────────────────────────────────────────────────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
-- Simulate a public account: a uid with NO profiles row.
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';

SELECT
  (SELECT count(*) FROM bank_accounts)     AS bank_accounts,
  (SELECT count(*) FROM payment_requests)  AS payment_requests,
  (SELECT count(*) FROM liabilities)       AS liabilities,
  (SELECT count(*) FROM projects)          AS projects,
  (SELECT count(*) FROM profiles)          AS profiles,
  (SELECT count(*) FROM personal_accounts) AS personal_accounts;
-- Expected: 0, 0, 0, 0, 0, 0
ROLLBACK;
