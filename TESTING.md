# OPM Flash — End-to-End Test Checklist

Run this once with **live data** before relying on the app. Tick each box. Anything
that fails, note the screen + the error text.

## Automated unit tests — `npm test`
A fast **vitest** suite covers the pure / security-critical logic — no DB, no network, no AI:
- **EP/GM finance redaction** (`test/oversight.test.ts`) — asserts an Operations/Production brief can never carry bank balances, cash position, or row-level transaction entries.
- **Brief profile boundary** (`test/brief-profiles.test.ts`) — EP/GM use the redacted "oversight" finance, never the full snapshot; only the founder writes to `founder_briefs`.
- **What Matters builders** (`test/what-matters.test.ts`, ships with that feature) — the page-scoped focus logic.

Run `npm test` (or `npx vitest`) before pushing changes to those modules; keep the redaction tests green.

## 0. Database setup (do first)
- [ ] Run the **consolidated migration** in Supabase (all tables/policies). Expect "Success. No rows returned."
- [ ] Run **`migration-hardening.sql`** last (period lock + AI usage).
- [ ] Open **Tally Export → Setup status** shows **"All set"**.

## 1. Users & access
- [ ] Invite a new user (Users → Invite). They get the email and can set a password.
- [ ] New user signs in; sidebar shows only what their role allows.
- [ ] Add a **Driver / Office Assistant** to a project's Core Team; confirm they see only that project.
- [ ] Field member posts a **Daily Check-in**; founder sees it.

## 2. Finance core
- [ ] Record a cash entry, a vendor, a bank account — all save and show.
- [ ] Create a **payment** with GST + TDS. Confirm Net Payable = base + GST − TDS.
- [ ] Approve it; it moves out of "open" into the settled archive on the project page.
- [ ] Record **income**; project P&L updates.

## 3. AI (needs Anthropic credits)
- [ ] Attach a bill on Payments → fields auto-fill. (If credits are out, the **amber banner** appears — that's correct.)
- [ ] Analyze a document → summary appears.
- [ ] Ask OPM a question → sensible answer from real data.
- [ ] Settings → **AI Usage** counter goes up after each call.
- [ ] Set the cap to a low number, exceed it → AI calls are blocked with a clear message.

## 4. Tally export (hand files to the accountant)
- [ ] Vouchers page: add a ledger (e.g. your bank), enter a balanced **Journal**; it saves only when Dr = Cr.
- [ ] Tally Export → **Step 1** download Chart of Accounts XML.
- [ ] Tally Export → **Step 3** download Vouchers XML for last month.
- [ ] Accountant imports **Masters first, then Vouchers** into a **Tally test company**.
- [ ] **Verify in Tally:** a GST payment posts base→party, GST→Input CGST/SGST, TDS→TDS Payable, net→bank, and **balances**.
- [ ] Confirm amounts match (remember: app `amount` is the base; gross = base + GST).

## 5. Month-end lock
- [ ] Settings → **Month-end Lock** → lock through last month.
- [ ] Try to add/edit income or a voucher dated in the locked period → **blocked** with "Books are locked through …".
- [ ] Add an entry dated *today* → allowed.
- [ ] Unlock → the locked-period edit now works.

## 6. Per-project documents
- [ ] Open a project → **Documents & Formats** → Print a Deal Memo / Appointment Letter; header shows **OPM CINEMAS** and the **film name**.

## 7. Integrations (previously unverified)
- [ ] **WhatsApp:** a user who joined the Twilio sandbox receives an alert (Users → WhatsApp test, or trigger a real alert).
- [ ] **Email:** `/api/alerts/test-broadcast` (founder) → all active users get the email.
- [ ] **Daily briefing cron** fires (check next morning, or trigger the endpoint with the CRON_SECRET).

## Known caveats to watch
- AI features need **Anthropic credits**; web search is **off** (flag in `lib/flags.ts`).
- Tally export reads **approved/paid** payments + **received** income only.
- The operational records and the Vouchers ledger are **not yet auto-linked** — vouchers entered on the Vouchers page are separate from payments (a planned follow-up).
