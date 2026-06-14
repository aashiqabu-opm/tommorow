# Online Auditions — Design Blueprint

Status: **finalised, not yet built.** Build in one pass when approved.

## Goal
Let OPM run online auditions per project: actors submit in <2 min, AI validates +
organises + drafts feedback, the casting team reviews on an in-app board. An OPM
that actually *responds* to applicants = a talent magnet.

## Locked decisions
- **Photos:** uploaded to a new public `casting` storage bucket (light).
- **Video:** **links only** (any source); AI just checks the link resolves. No video hosting.
- **Feedback:** **everyone gets a response.** Acknowledgement auto-sends; any
  status/constructive feedback is **AI-drafted, human-approved** before send.
- **Validation:** **soft — flag, never block.** Every entry reaches the board,
  marked with any issues; the actor is auto-nudged to fix (bad photo, dead link).
- **Distribution:** (1) public link + QR per project, (2) WhatsApp submission to
  the existing number, (3) embed on opmcinemas.com.

## Applicant flow (public, no login)
Route `/audition/[project-slug]` — bypasses auth middleware (like `api/whatsapp`).
Mobile-first single screen:
- Name, phone, age, location, role applying for (from project's open roles)
- 1–3 photos (phone camera) → `casting` bucket
- Self-tape **video link**
- Optional: height, languages, prior work / Instagram, consent checkbox
- Submit → instant reference code + WhatsApp/email acknowledgement

## AI's three jobs
1. **Validate** (on submit, before board): completeness, photo sanity (real clear
   face via vision model), link resolves, spam/duplicate. Soft-flag + fix-it nudge.
2. **Organise:** auto-tag (apparent age range, languages, role-fit), score vs the
   role brief, per-role ranked buckets, dedupe, daily digest to director via
   WhatsApp/email. Ranking assistant only — humans decide (like never-auto-pay).
3. **Feedback:** tiered — acknowledgement (auto) / status update (1-click) /
   constructive notes (AI draft → human approve). Guardrails: warm, professional,
   only craft & submission quality, **never** immutable physical traits.

## Casting team flow (in-app, new "Casting" page per project)
Grid of submissions: photo, AI summary, fit score. Actions: Shortlist / Maybe /
Pass / Callback. Filter by role/age/language. Review queue for flagged entries.
Outbound feedback approval inbox (approve/edit AI drafts).

## Workflow states
`new → (flagged?) → shortlist | maybe | pass → callback → cast`

## Data model (draft)
- `casting_calls` — project_id, role briefs (name + description + criteria), open/closed, slug
- `casting_submissions` — call_id, name, phone, age, location, role, photo_urls[],
  video_url, extras (jsonb), ai_score, ai_tags (jsonb), ai_summary, status,
  flags (jsonb), ref_code, created_at
- `casting_feedback` — submission_id, kind (ack|status|notes), draft_text,
  approved_by, approved_at, sent_at, channel
- new `casting` storage bucket (public, image/* only)

## OPEN — needs a decision before build
1. **Consent & minors (legal).** We're collecting personal data + photos, often of
   aspiring/young actors. Recommend: a required consent checkbox (data used only
   for casting, retained N months), and a **guardian-consent** field if age < 18.
   India's DPDP Act makes this real. Decision: retention window + minor handling.
2. **WhatsApp submission routing.** The inbound webhook today serves *registered
   staff* (bills/queries). Audition entries come from *unknown public numbers*.
   Proposed: an unknown number sending media is prompted "Which project are you
   auditioning for?" (or uses a keyword/QR-prefilled link), then the bot collects
   photo + video link into a submission. Needs a small state machine in the webhook.

## Phased build (one push, but layered internally)
- v1: public form + photos + submissions table + in-app review board (no AI)
- v2: AI validate + organise + daily digest
- v3: AI feedback drafting/approval + WhatsApp submission channel + opmcinemas embed
