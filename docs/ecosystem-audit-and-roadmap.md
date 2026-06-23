# OPM Flash — Ecosystem Audit & Roadmap (pre-production → release)

Status: **analysis + plan for later.** Benchmarks our app against Malayalam-cinema
production practice and global tools (Movie Magic, StudioBinder, Yamdu, Scenechronize),
identifies gaps, and proposes the most efficient way the app should work + a UX/layout
redesign. No build yet.

## 1. Pipeline coverage — where we stand
Legend: ✅ solid · 🟡 partial · ❌ missing

### Development / Pre-production
- ✅ Projects, per-project core team & roles, check-ins
- ✅ Script/screenplay upload + AI read; document vault (role-gated edit)
- ✅ Casting: characters, auditions; casting director (auto-removed post-shoot)
- ✅ Script breakdown (scenes + elements) + shoot schedule + locations (perm/hospital)
- 🟡 Film **budgeting** — we have budget_lines + cost report, but not a full *budget builder*
  (top sheet, account codes, fringes/contingency, scenarios)
- 🟡 Permits/NOC — only a status flag on locations
- ❌ **Storyboard / shot list** (per scene)
- ❌ **Cast & crew deal memos / contracts with e-sign** (Malayalam: FEFKA/AMMA/Producers'
  Council association compliance, agreed fee + advance + TDS already in crew ledger)
- ❌ Production **calendar** view (everything time-based in one place)

### Production (shoot)
- ✅ Daily Production Report (DPR), petty cash on set, crew/cast ledger & payments
- ✅ Per-day requirements + checklist, junior-artist counts
- 🟡 **Call sheets** — planned (Phase 2): AI-draft → PDF → WhatsApp/email
- ❌ **Day-Out-of-Days** (cast×day SW/W/H/F) — planned Phase 3
- ❌ Continuity / script-supervisor notes; dailies/footage log
- ❌ Attendance ↔ junior-artist payment reconciliation

### Post-production
- 🟡 Phase tracker exists, but no **detailed post pipeline** (edit → DI/colour → sound
  design/mix → VFX → songs/BGM → dubbing → final mix → censor)
- ❌ **VFX shot tracker**; **songs/music** production + lyrics/rights; **dubbing** tracker
- ❌ **CBFC censor** application tracker
- ❌ **Deliverables checklist** (DCP/KDM, satellite M&E + subtitles, OTT spec sheets)

### Release / Distribution / Recovery
- ✅ Box-office collections + AI release-watch (piracy/reputation); campaign assets;
  **press kit**; **channels** (YouTube/social links); funding (investors/loans)
- 🟡 Revenue & P&L, forecast — but no **rights/deal manager** (theatrical territories,
  satellite, OTT, audio/music) as first-class deals
- 🟡 Investor **recovery waterfall** — funding metrics exist, not a settlement view
- ❌ **Release calendar** (date, theatre/screen count, shows); publicity **campaign
  planner** + social **scheduling** (we store links/assets, don't schedule posts)
- ❌ Live YouTube/social **stats** (needs API wiring)

### Cross-cutting (company)
- ✅ Cash, bank, reconcile, payments (WhatsApp bill→draft), vendors, liabilities,
  payroll, vouchers, Tally export, GST/TDS compliance, **GST inputs from founder**,
  statements, audit log, AI assistant (Ask OPM, now incl. casting/schedule/screenplay),
  monitoring/alerts, error+cron alerting, PWA, rate-limiting
- ✅ Founder Personal module (finance/tax/legal/health/vehicles/cards + Gmail ingestion)

## 2. Gaps to complete the ecosystem (prioritised)
**Tier 1 — finish the production spine (high value, builds on what exists)**
1. Call sheets (Phase 2) + Day-Out-of-Days (Phase 3) + production **calendar**.
2. **Detailed post-production pipeline** (edit/DI/sound/VFX/songs/dubbing/censor milestones per project).
3. **Deliverables & censor** checklists (CBFC, DCP/KDM, satellite/OTT specs).
4. **Cast & crew deal memos / contracts** (generate from crew ledger + e-sign + association compliance flags).

**Tier 2 — release & money**
5. **Rights & deals manager** (theatrical/satellite/OTT/audio) feeding revenue + recovery **waterfall** to investors.
6. **Release calendar** + theatre/screen/show tracking; tie to box-office collections.
7. **Publicity planner** + social **post scheduling** + live YouTube/social stats.

**Tier 3 — depth & polish**
8. Full **budget builder** (top sheet, fringes, scenarios) feeding the cost report.
9. Storyboard/shot list; continuity notes; dailies log.
10. Attendance ↔ junior-artist payment reconciliation.

## 3. Most efficient way the app should work
- **Role-aware home ("Today" command center).** First screen = what *this person* must act on today:
  - Founder: cash position + runway, approvals pending, today's shoot status, alerts, money at risk.
  - Accountant: approvals, dues/receivables, GST/TDS deadlines, reconciliation gaps.
  - Director/AD: today's call sheet, schedule, blockers, casting status.
  - Each role lands on a tailored dashboard, not the same generic one.
- **One action stream:** approvals, blockers, due dates, alerts — all actionable from home (approve/reject, mark done) without deep navigation. (Ties to WhatsApp.)
- **Project workspace, cleanly sub-navigated:** Overview · Money · Production · Casting · Schedule · Post · Release · Documents — instead of one long scroll.
- **AI as the front door:** Ask OPM pinned/omnipresent for "what's due", "who's on set tomorrow", "P&L of X".
- **Mobile call sheets & approvals** (PWA already installable) — the floor runs on phones.
- **Notifications center** + push (WhatsApp/email already wired) so nothing is missed.

## 4. UX / layout — the "first eyeball" hierarchy
Current sidebar order is **finance-first** (Cash, Accounts, Reconcile, Payments…). For a
*production house*, the eye should hit **what's live and what needs action** first.

**Recommended landing hierarchy (top → bottom):**
1. **Headline strip** — 3-4 big tiles: Cash available + runway · Approvals pending (₹) ·
   Active projects / today's shoot · Urgent alerts. (Big numbers, status colour — like the
   personal "spent this month" tile.)
2. **Needs you now** — action list (approvals, blockers, due dates) with inline actions.
3. **Active films** — card per project: stage, next shoot day, budget burn, open tasks.
4. **Money & ops** below the fold.

**Sidebar regrouping (production-house order):**
`Today/Dashboard → Films (Projects) → Production (Schedule, Casting, Documents) →
Finance → Accounting → Intelligence (Ask OPM, Market, Reports) → Admin`.
Move **Ask OPM to the top** (it's the fastest path to any answer).

**General layout principles to apply:** big primary numbers; consistent status colours
(green/amber/red); reduce per-page density (cards over long tables where scannability
matters); sticky primary action button; breadcrumbs on project sub-pages; empty-states
that teach. Keep the dark/amber theme.

## 5. Recommended build roadmap (waves)
- **Wave A:** Call sheets + DOOD + production calendar; role-aware home + sidebar reorder.
- **Wave B:** Post-production pipeline + deliverables/censor; deal memos/contracts.
- **Wave C:** Rights & deals manager + recovery waterfall + release calendar.
- **Wave D:** Publicity planner + social scheduling + live channel stats; budget builder; storyboard/continuity.

## Decisions to take when we resume
1. Start with **production spine (Wave A)** or the **home/UX redesign** first?
2. Confirm the **per-role landing** definitions above.
3. e-sign provider for deal memos (or simple upload-signed-copy for v1).
