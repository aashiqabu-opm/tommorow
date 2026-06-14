# Personal / Founder Module — Build Plan (finalised)

Status: **finalised, awaiting go for Phase 1.** Founder-only; build inside OPM Office.

## Locked decisions
- **Placement:** distinct "Personal" module pinned at the **top of the sidebar**, above Dashboard; visible only to the owner.
- **Access:** owner (you) + optionally **one trusted delegate** with limited (read) view.
- **Isolation:** same app, own **private DB schema `personal.*`** + a **private storage bucket** (signed URLs); RLS keyed to the owner's user ID, not the founder role.
- **Priority pillars:** (A) Founder↔company money, (B) Tax engine (India), (C) Film income & legal vault. General multi-asset net worth deprioritised — emerges as a landing summary.
- **AI:** tracking + alerting throughout; personal alerts go ONLY to owner/delegate, never a company channel.

## Pillar A — Founder ↔ Company money
- `personal.founder_company_ledger` — director's loan, capital introduced, drawings, dividends, reimbursements. Bridges to company books (a company-side loan-from-you mirrors here as a receivable).
- `personal.guarantees` — personal guarantees on company/other loans (lender, amount, linked company loan, expiry, status) → exposure view.
- Reimbursements owed to you (link to company `payment_requests` you paid personally).
- **Exposure dashboard:** "if everything goes wrong, I'm personally liable for ₹X."
- AI: tax-efficient **pay-yourself modelling** (salary vs dividend vs loan repayment).

## Pillar B — Tax engine (India)
- `personal.tax_profile` — PAN, regime (old/new), financial year.
- `personal.tax_items` — advance-tax installments (4), ITR, TDS entries, with due dates + status.
- `personal.deductions` — 80C / 80D / home-loan interest / etc.
- `personal.capital_gains` — asset, buy/sell dates & amounts, LTCG vs STCG.
- AI: **advance-tax estimator** from income sources; **ITR-ready pack** (summary + docs for the CA); reminders for the 4 advance-tax dates + ITR.

## Pillar C — Film income & legal vault
- `personal.film_stakes` — film/project, entity/SPV, ownership %, investment, profit-share terms.
- `personal.royalties` — film, source (satellite/OTT/music/theatrical overflow), amount, expected/received date, status.
- `personal.documents` — legal vault (deeds, agreements, wills, nominee) in the private bucket, AI summary + key_dates.
- AI: key-date alerts (agreement/guarantee expiry), royalty-due tracking.

## Landing — founder dashboard
Summary of the three pillars: net position (what company owes you − guarantees/liabilities), tax due next, royalties pending, upcoming key dates.

## AI tracking & alerting
- **Private personal digest** (daily/weekly) — net position move, what's due, exposure — via WhatsApp + email to owner only.
- **Real-time alerts** — advance-tax due, document/guarantee expiry, royalty landed/overdue.
- Reuses the monitoring/alert infra but with a personal recipient resolver that returns ONLY the owner (+ delegate). Structurally cannot leak to a company channel.
- **Personal Ask OPM tools** (owner-gated): "how exposed am I to the company?", "what tax do I owe?", "which royalties are pending?", "what's due this month?".

## Access control & safeguards
- Every `personal.*` table has `owner_id`. Read = owner OR granted delegate; write = owner only.
- Private storage bucket, signed URLs only.
- Excluded from all company reports, other users' Ask OPM, and company audit visibility.
- Before ship: verify with a 2nd test user that they get ZERO personal rows; typecheck + build + deploy per phase.

## Phased build
- **Phase 1 (foundation + Pillar A core):** `personal` schema + RLS + private bucket + top-of-sidebar module + landing shell + founder↔company ledger + guarantees + reimbursements + exposure view.
- **Phase 2 (Pillars B + C):** tax tables + advance-tax estimator + deductions + capital gains; film stakes + royalties; legal document vault with AI.
- **Phase 3 (intelligence):** pay-yourself modelling + advance-tax/key-date alerting + private digest + personal Ask OPM tools + delegate management + ITR pack.

## Needed from you (during build, not now)
- Delegate identity (when you want to grant it).
- Real figures to load: director's loan/capital, guarantees, film stakes, tax profile (PAN/regime), legal docs.
- Which company entity = OPM Cinemas for the bridge.
