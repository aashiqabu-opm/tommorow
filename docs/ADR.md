# Architecture Decision Record — OPM Flash
*Status date: 2026-06-22 · Horizon: 24 months · Grounded in the live system (Next 15.3 / React 19 / TS 5.8 / Tailwind 4; Supabase Postgres, 122 tables, RLS on every table, 331 policies; Vercel; Anthropic; pgvector 0.8 available-but-not-enabled)*

Each ADR: Decision · Reasoning · Alternatives · Risks · Migration path if reversed.

## ADR-001 — Single-tenant today → Org → Company → Project within 12 months
**Decision:** Stay single trusted-org but evolve to Organization → Company → Project with company-scoped RLS; no public multi-tenant SaaS isolation in this window.
**Reasoning:** Six entities must share some masters yet silo money/payroll/deals; today there's no company boundary (Records visible to any Cinemas finance user).
**Alternatives:** stay flat (fails on 2nd company's confidential data); full multi-tenant now (premature); a Supabase project per company (kills shared masters, 5× ops).
**Risks:** re-deriving 331 RLS policies company-aware is the highest-risk work; a wrong policy leaks books or locks out the founder. Mitigate: domain-by-domain, rolled-back-tx validation, feature flag.
**Reverse:** technically trivial (ignore company_id) but you'd lose entity separation — only if OPM reconsolidates to one entity.

## ADR-002 — Supabase as system of record (Postgres + Auth + Storage + Vector) — LOCK candidate
**Decision:** Keep Supabase for DB/Auth/Storage and add Supabase Vector (pgvector) for RAG.
**Reasoning:** RLS *is* the security architecture (100% coverage, 331 policies); one source of truth + one permission model; tiny data volumes; pgvector already available.
**Alternatives:** self-host PG + Clerk/Auth0 + S3 + Pinecone (multiplies vendors, splits authz); Firebase (wrong for relational/Tally); raw RDS (loses tooling).
**Risks:** vendor concentration; pricing/feature changes; pool limits at scale (mitigated by PgBouncer).
**Reverse:** Postgres portable via `pg_dump`; painful parts = re-implement Auth + migrate Storage/signed-URL code; weeks, no data loss.

## ADR-003 — Vercel host/runtime — LOCK candidate
**Decision:** Keep Vercel (hosting, serverless, cron); push-to-main auto-deploy + PR previews.
**Reasoning:** zero-config Next 15, scales to tiny spiky load, built-in cron + instant rollback, ~$20/mo.
**Alternatives:** self-host/Fly/Render (more ops); Netlify/Cloudflare (no advantage); K8s (over-engineering).
**Risks:** preview hits prod DB (High); 300s serverless limit; minimal Vercel lock-in.
**Reverse:** Next is portable (`next start`/Docker); cron → Actions/pg_cron. Low-moderate effort; good reversibility.

## ADR-004 — Anthropic-primary, multi-vendor-by-capability (not single-model)
**Decision:** Claude (Opus reasoning/extraction, Haiku cheap) + a dedicated **embeddings** vendor (Voyage/OpenAI) for RAG; no third reasoning model.
**Reasoning:** Claude quality + prompt-based-JSON discipline; Anthropic has no embeddings API so a second vendor is *required*; single reasoning vendor for prompt consistency.
**Alternatives:** Anthropic-only (impossible for RAG); full multi-model router (maintenance burden); local/OSS (ops burden, weaker extraction).
**Risks:** two AI vendors; Opus cost concentration (18 sites); provider changes.
**Reverse (swap reasoning model):** medium — calls centralized in `lib/ai/*`, but re-prompt + re-eval extractors. Embeddings vendor trivially swappable (re-embed).

## ADR-005 — RAG on Supabase Vector, hybrid retrieval (no external vector DB)
**Decision:** pgvector tables (`kb_documents`, `kb_chunks` + HNSW); hybrid (vector + pg_trgm + metadata incl. company_id); embeddings via Voyage/OpenAI; ingest via mupdf + Claude vision OCR; RLS/company-scoped retrieval.
**Reasoning:** one source of truth + one permission boundary; no new infra/cost; hybrid beats pure-vector for contracts/financials (exact names/clauses/GSTINs).
**Alternatives:** Pinecone/Weaviate/Qdrant (split data, replicate RLS) — rejected.
**Risks:** embeddings drift (re-embed on model change); OCR quality; chunking iteration.
**Reverse:** export chunks + re-embed elsewhere; orchestration is vendor-agnostic. Low lock-in.

## ADR-006 — PWA-first mobile; Capacitor only if needed; no native-from-scratch
**Decision:** Harden the PWA; wrap with Capacitor if app-store/native push/biometrics needed; no separate native apps this window.
**Reasoning:** internal/B2B; on-set needs are Web-API-capable; native-from-scratch = 2× maintenance for ~30 users.
**Alternatives:** RN/Expo dual native; full native — over-investment now.
**Risks:** iOS PWA limits (background/push); precise background geolocation constrained on web.
**Reverse (go native):** Capacitor is the incremental bridge; full RN rewrite = months (avoid unless SaaS consumer UX demands).

## ADR-007 — Supabase Storage, private-by-default, signed URLs
**Decision:** All storage in Supabase; buckets **private**; 60-min signed URLs; path convention `{scope}/{id}/...`.
**Reasoning:** co-located with DB+Auth; signed URLs enforce per-request authz.
**Status note:** the legacy `documents` bucket was public — **fixed** (private + signed URLs via `/api/storage/sign`).
**Alternatives:** S3/R2 (cheaper at huge scale; splits permission model; unnecessary now).
**Reverse (to S3/R2):** bulk-copy objects + rewrite signer; moderate, no data-model change.

## ADR-008 — Backups: Supabase PITR + tested quarterly restore + DR runbook
**Decision:** PITR (paid tier) + scheduled `pg_dump` to independent encrypted storage + drilled restore (quarterly). See `docs/BACKUP.md`.
**Reasoning:** the DB holds the company's financial/legal truth; defaults were undocumented/untested.
**Alternatives:** defaults only (no tested restore = no real backup); self-managed replication (overkill).
**Risks:** PITR cost; drill time; off-platform dump must itself be secured.
**Reverse:** N/A — never remove backups.

## ADR-009 — Security model: RLS-primary → company-scoped RBAC + SSO + encryption
**Decision:** RLS as enforcement core; add company-aware roles, Workspace SSO + MFA, field-level PII encryption, append-only audit, read-only/redacted Investor tier.
**Reasoning:** RLS coverage is the strongest asset (100%); gaps are identity, key custody, PII at rest, investor access.
**Alternatives:** app-layer authz (weaker, bypassable) — rejected; external OPA (unnecessary).
**Risks:** SSO lockout risk; encryption query complexity; intersects ADR-001 risk.
**Reverse:** you don't reverse "more security"; individual choices swappable via JWT issuer.

## ADR-010 — API: internal Next routes + RLS client; no public API yet
**Decision:** Server logic in Next API routes + server components/actions on the RLS client; admin/service-role only in crons/privileged routes; no public/partner API this window; cron auth via `CRON_SECRET`.
**Reasoning:** no external consumers; RLS + server-fetch is sufficient/simplest; a public API is a versioning/security commitment to defer to SaaS.
**Alternatives:** GraphQL/tRPC (ceremony for internal app); PostgREST already available for reads.
**Risks:** a future mobile-native/partner need may require consolidating ad-hoc routes.
**Reverse (need public API):** add versioned `/api/v1` + API-key/JWT + rate limiting; RLS already protects data, so additive.

## ADR-011 — ERP expansion: extend the modular monolith; integrate Tally, don't replace it
**Decision:** Grow ERP-like modules in-app (payroll, vendor ledgers, GST/TDS, vouchers, cost engine); keep **Tally as statutory system of record** via CSV/XML export.
**Reasoning:** Indian statutory accounting + CA workflows live in Tally; OPM Flash's edge is *operational* finance Tally can't do; replacing Tally = compliance risk for no gain.
**Alternatives:** full in-app statutory accounting (huge scope, liability); third-party ERP (wrong fit).
**Risks:** export-format drift; app↔Tally reconciliation gaps.
**Reverse:** accounting tables exist; deepening is incremental but not lightly undertaken.

## ADR-012 — SaaS productization: ring-fenced option, on traction only
**Decision:** Treat SaaS as a Phase-2 option; prerequisites = ADR-001 + ADR-009 (built for OPM anyway); validate with 2–3 design partners before committing.
**Reasoning:** defensible wedge = India/Kerala compliance + cost engine; small/slow market; build internal first.
**Alternatives:** productize now (premature); never (leaves a real if modest opportunity).
**Risks:** hostile-tenant isolation ≫ trusted multi-company; billing/support/SLA is a different business.
**Reverse (kill SaaS):** costless — ring-fenced; the multi-company + security work was justified internally regardless.

---

## Decisions that should NOT be revisited for 24 months
**1. Supabase as system of record (ADR-002).** *Expensive because:* it's the spine — 122 tables, 331 policies, Auth, Storage, Vector all assume it; migrating = re-home the permission model + Auth + Storage, months, high regression risk on financial data. *Reopen only if:* Supabase pricing turns punitive at our (small) scale, a hard limit is hit, or compliance forbids the vendor.

**2. RLS as primary security model (ADR-009 core).** *Expensive because:* every table/query is built around it; replacing with app-layer authz re-secures 122 tables and trusts app code over the DB — strictly weaker + full re-audit. *Reopen only if:* moving off Postgres entirely, or a regulator mandates an external policy engine.

**3. Next.js + Vercel (ADR-003).** *Expensive because:* frontend + 36 routes + 11 crons are Next/Vercel-shaped; re-platforming = weeks for no user gain. *Reopen only if:* Vercel cost/limits bite (then move host, not framework — Next is portable). Framework choice: locked.

**4. Anthropic Claude as reasoning model (ADR-004).** *Expensive because:* prompts/extraction across 20 sites are tuned to Claude; swapping = re-prompt + re-eval every extractor (financial correctness at stake). *Reopen only if:* a competitor delivers a decisive accuracy/cost step-change confirmed by internal evals. (The embeddings slot is intentionally *not* locked.)

**5. Org → Company → Project direction (ADR-001).** *Expensive because:* the AI layer, security tiers, and any SaaS option depend on it; re-litigating mid-build strands half-migrated RLS — the most dangerous state. *Reopen only if:* OPM Group consolidates to a single legal entity.

**6. Tally as statutory system of record (ADR-011).** *Expensive because:* owning statutory accounting creates regulatory liability + duplicates a CA-trusted tool; reversing mid-film risks compliance. *Reopen only if:* Tally is discontinued or India mandates API-based statutory filing.

**Explicitly NOT locked (revisit on evidence):** SaaS productization (012), native-mobile escalation (006), embeddings vendor (004), public API (010), per-extractor model choice (Opus↔Haiku). Cheap to change and dependent on traction/usage data not yet available.

*Live gaps that undercut the "investor-grade" claim every ADR rests on: public `documents` bucket (**fixed**) and untested backups (**fixed — `BACKUP.md`**). Remaining: separate preview DB + CI gate.*
