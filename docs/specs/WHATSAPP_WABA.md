# WhatsApp WABA Cutover — Runbook

> Move OPM Flash WhatsApp from the **Twilio sandbox** (delivers only to numbers
> that joined it — why Subin's login couldn't be texted) to a **production
> WhatsApp Business Account (WABA)** that can message any staff/crew number.
> **The app code is already WABA-ready — this is an external provisioning + env
> swap, not a code change.**

## Current state
- `lib/alerts/channels.ts` sends via `sendWhatsApp()` (free-form) and
  `sendWhatsAppTemplate()` (approved templates by `ContentSid`), both using
  `TWILIO_WHATSAPP_FROM` + the Twilio Messages API.
- `TWILIO_WHATSAPP_FROM` currently points at the Twilio **sandbox** number
  (`…8886`). Free-form messages only reach numbers that have joined the sandbox.

## The cutover (external — founder/admin-driven)
1. **Meta Business verification** (Meta Business Manager) — verify **OPM Cinemas LLP**.
   This is the slow gate (days–weeks). Browser-locked; no API path.
2. **Register a production WhatsApp sender in Twilio** — a real phone number bound
   to the verified WABA (Twilio Console → Messaging → Senders → WhatsApp).
3. **Create + get Meta approval for message templates** — one per *business-initiated*
   message type. Today the app has two (`TWILIO_TEMPLATE_NEW_BILL_SID`,
   `TWILIO_TEMPLATE_REJECTED_SID`). You'll need to add templates for anything else
   you want to push (e.g. **staff login/onboarding**, alerts) — see the rule below.
4. **Swap the Vercel env vars** (Production):
   - `TWILIO_WHATSAPP_FROM` → `whatsapp:+<production number>`
   - `TWILIO_TEMPLATE_*_SID` → the approved template `ContentSid`s
   - (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` stay the same Twilio account.)

## The rule that bites: 24-hour window vs templates
- **Free-form** (`sendWhatsApp`) only works **inside a 24-hour session window** —
  i.e. *after the recipient messages you first*. It will NOT deliver a cold,
  business-initiated message in production.
- **Business-initiated** messages (login credentials, alerts, reminders sent
  without the user writing first) **must use an approved template**
  (`sendWhatsAppTemplate` + `ContentSid`).
- ⇒ **Subin's login over WhatsApp needs an approved "login/onboarding" template.**
  Until that exists, email is the reliable channel (already working), or the
  recipient must message the number first to open the 24h window.

## Verify after cutover
- Signed in: **`GET /api/alerts/test`** → reports the WhatsApp channel status.
- Send a real test to a confirmed number (one you control) before relying on it.

## Note on the monorepo consolidation
Crons were dropped from this repo (`vercel.json` = `crons: []`, "consolidated into
opm-platform"). If OPM Flash now deploys via **opm-platform**, set the WABA env
vars **there** (and confirm that repo runs the alert paths), not only here.
