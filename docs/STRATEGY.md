# OPM Office — Strategic CTO Review & 3-Year Architecture Roadmap
*Six entities on one operating system · 2026-06-22 · grounded in the live system (122 tables, RLS-everywhere, role-scoped single-org today; pgvector 0.8 available but not enabled)*

> **The decision everything hinges on:** OPM Office is today a **single-organization, role-scoped** app. Running six entities (Cinemas, Records, Tomorrow Film School, Kochi Music Foundation, future productions, investor relations) requires moving to **Organization → Company → Project before anything else is worth building.** Skipping it means bolting six businesses onto a structure that can't cleanly separate or share their data.

## A. Multi-Company Architecture (do first)
**Verdict: do NOT stay single-tenant. Move to `Organization → Company → Project`** — multi-company within one trusted org (not hostile-tenant SaaS isolation).
Today RLS keys only off `profiles.role` + `project_id`; no company boundary, so Records' finances are visible to any Cinemas finance user.
**Target:** `organizations → companies (Cinemas/Records/Film School/Foundation/SPVs) → projects`; `company_memberships(user, company, role)`.
**Migration (phased, non-breaking):** (1) add orgs/companies/memberships, seed OPM Cinemas; (2) add nullable `company_id` to every scoped table, **backfill to OPM Cinemas**, set NOT NULL; (3) evolve RLS helpers to company-aware (`is_finance(company_id)`), keep `is_founder()` as cross-company super-role — re-derive all 331 policies domain-by-domain, each a validated rolled-back-tx migration; (4) company switcher UI; (5) model org-shared masters (vendors, technicians, contracts) vs company-siloed money/payroll/deals.
**Risk:** a wrong company-aware policy leaks one company's books to another or locks out the founder — the most carefully reviewed work in the roadmap.

## B. Knowledge Layer — RAG on Supabase Vector (no new infra)
`pgvector` is available now (one `CREATE EXTENSION vector`). **Do not** add Pinecone/Weaviate — it'd split the source of truth and duplicate RLS scoping.
**One honest gap:** Anthropic has **no embeddings API** → add a dedicated embeddings vendor (**Voyage AI `voyage-3`** recommended, or OpenAI `text-embedding-3`). Claude stays the reasoning model.
**Ingestion:** Upload → text extract (mupdf for text PDFs, Claude vision OCR for scans) → ~800-token chunks → embed → `kb_chunks(embedding vector, metadata, company_id)` with HNSW index → **hybrid retrieval** (vector + `pg_trgm` keyword + metadata filter), RLS-scoped by company.
**Domain intelligences:** Contract (parties/expiry/milestones → alerts + encumbrances), Financial (NL Q&A over budget/payments + source docs), Screenplay (auto-breakdown → seed scenes + safety-gate sequences). Build order: contract + financial first, screenplay later.

## C. AI Layer — "OPM AI" (one engine, six personas)
Build **one retrieval-augmented, tool-using engine**; six personas = system prompt + retrieval scope + allowed tools:
- **CFO** (finance tables + financial KB; budget actuals, P&L, cash-flow, receivables)
- **Production** (project tables + screenplay KB; DPR, readiness, gates, schedule)
- **Legal** (contracts KB + permits/encumbrances; expiry calendar, clause lookup w/ citations)
- **Investor** (P&L + cash-flow + slate; **read-only, redacted**)
- **Festival** (submissions/deadlines KB + calendar)
- **Film School** (curriculum/students KB)
Guardrails: every answer cites sources; Investor never sees personal vault/payroll/raw creditor data; company-scoped via existing RLS. Opus for reasoning, Haiku for RAG-Q&A/extraction.

## D. Mobile — PWA-first; Capacitor later; no native-from-scratch
Harden the existing PWA (installable, offline read, camera capture, web push) — covers ~90% of on-set/founder needs. If app-store/native push/biometric needed → wrap with **Capacitor** (one codebase). Separate native iOS+Android only if SaaS consumer UX demands it. On-set needs (geofence, QR, receipt capture) are Web-API-capable.

## E. Security Roadmap
**Year 1:** private `documents` bucket (**done**); backups + tested restore + DR runbook (**done — `BACKUP.md`**); separate staging/preview DB; CI gate (Actions: tsc/build/lint/migration-check); secret management + rotation.
**Year 2:** Google Workspace SSO + enforced MFA; company-scoped RBAC; field-level encryption (bank/PAN/GSTIN/contract PII); immutable audit log; DLP/redaction on the Investor persona.
**Year 3 (if SaaS):** SOC 2 Type II / ISO 27001 path, pen-testing, per-tenant isolation hardening, signed audit exports.

## F. SaaS / TAM (honest)
A niche, not a rocket. Comparable category (StudioBinder/Yamdu/Scenechronize/Croogloo) ≈ **$300M–1B global, fragmented**. OPM's serviceable niche (India + diaspora indie/mid + film schools + festivals): few hundred realistic paying production houses at ₹15–50k/mo → SAM ~₹15–60 Cr/yr at improbably high share. **Defensible wedge = India/Kerala-specific compliance (FEFKA/AWBI/KSFDC/GST/Tally) + the cost engine** — a real moat for the Indian market. **Path:** run OPM Group on it 12–18 months, add 2–3 friendly design-partner houses, then decide. SaaS is a ring-fenced Phase-2 bet, not the thesis.

## G. Technical Debt — ranked
**Critical:** public docs bucket (**fixed**); untested backups/DR (**fixed — runbook**); no CI gate before push-to-main.
**High:** preview shares prod DB; manual forward-only migrations; single-operator key custody; no automated tests on finance paths.
**Medium:** budget-actuals roll-up in ~6 places → centralize; Opus cost concentration; rate limiting on one webhook only; project-nav density.
**Low:** repeated CRUD boilerplate → shared component; no retention policy; dormant Twilio config.

## H. Board Recommendation — ₹5 crore over 3 years
Context: ₹5 Cr for *software* on an internal platform is generous; the risk is **over-engineering**, so the allocation favors leverage + safety and ring-fences the SaaS bet.
| # | Area | 3-yr | Why |
|---|---|---|---|
| 1 | Core eng team (1 senior lead + 1 mid + fractional designer) | **₹2.4 Cr (48%)** | Value = velocity + correctness; small senior team >> big junior one |
| 2 | Multi-company re-arch + security hardening | **₹0.8 Cr (16%)** | Non-negotiable foundation for six entities + investor trust |
| 3 | Knowledge + AI layer (RAG, embeddings, OPM AI) incl. AI usage budget | **₹0.9 Cr (18%)** | Differentiator; ~₹0.5 build + ~₹0.4 3-yr AI usage (Opus is the lever) |
| 4 | Infra & tooling (Supabase dedicated, monitoring/APM, backups, vault) | **₹0.4 Cr (8%)** | Rises with dedicated DB + observability |
| 5 | SaaS productization reserve (release only on traction) | **₹0.5 Cr (10%)** | Ring-fenced; spent only if design-partner evidence is real |
**Order:** 0–6 mo: hire lead, ship Criticals, start Org→Company. 6–18 mo: finish multi-company + security, ship RAG + CFO/Production/Legal personas, harden PWA. Yr 2–3: screenplay intelligence, remaining personas, **decide SaaS** on data.
**One-line verdict:** fund a small senior team to make the foundation multi-company + investor-secure, layer RAG + a single multi-persona OPM AI on top, and keep SaaS a ring-fenced option. The biggest risk is over-building a SaaS before the internal platform earns the right.
