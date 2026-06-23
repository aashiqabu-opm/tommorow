# OPM Flash — WhatsApp Production Setup

Notes for moving off the Twilio **sandbox** onto the company's verified WhatsApp
Business number **+91 77364 52777** (E.164: `+917736452777`).

On the sandbox, any message sends freely. On a production WhatsApp Business
number, every **business-initiated** message sent **outside the 24-hour
customer-service window** must be a **Meta-approved template**. Replies *within*
24 hours of the user messaging us can stay free-form.

---

## What runs on which channel now

| Notification | Channel after migration | Why |
|---|---|---|
| Bill submitted → reply to submitter | WhatsApp (free-form) | Reply within 24h of their inbound message |
| 🧾 New bill → approvers | **WhatsApp template** `new_bill_review` + email | Business-initiated, can be >24h |
| ❌ Payment rejected → submitter | **WhatsApp template** `payment_rejected` + email | Business-initiated, can be >24h |
| Daily digest | Email only | Multi-item summary, not a fixed template |
| AI morning briefing | Email only | Newsletter-style, not an approvable utility template |
| New Malayalam releases | Email only | Industry news = non-utility |
| Release watch | Email only | Digest = non-utility |
| Project stages updated | WhatsApp free-form (no-ops on prod) + email | Optional template — see below |
| Call sheet → crew | WhatsApp free-form (no-ops on prod) + email | Optional template — see below |
| Team add / invite | WhatsApp free-form (no-ops on prod) + email | Email is better for the temp password |
| Error/monitoring alerts | WhatsApp free-form (no-ops on prod) + email | Internal only |

"No-ops on prod" = `sendWhatsApp` returns `false` for these until/unless a
template is added; the email path still delivers, so nothing is lost.

---

## Templates to submit in Twilio (Content Template Builder → WhatsApp approval)

Create each at **Twilio Console → Messaging → Content Template Builder**, choose
category **Utility**, language **English**, then submit for WhatsApp approval.
After each is approved, copy its **Content SID** (`HX…`) into the env vars below.

### 1. `new_bill_review`  — category: Utility
**Body:**
```
🧾 New bill via WhatsApp from {{1}}: {{2}} ({{3}}) under "{{4}}". Review & approve in OPM Flash.
To decline, reply: REJECT {{5}}
```
**Variables / sample:**
- `{{1}}` submitter name — `Aashiq Abu`
- `{{2}}` payee — `Sky Lab Equipments`
- `{{3}}` amount — `₹12,500`
- `{{4}}` project — `Aja Sundari`
- `{{5}}` reject code — `A1B2C3`

### 2. `payment_rejected`  — category: Utility
**Body:**
```
❌ Your payment request — {{1}} ({{2}}) — was rejected by {{3}}. Reason: {{4}}
```
**Variables / sample:**
- `{{1}}` payee — `Sky Lab Equipments`
- `{{2}}` amount — `₹12,500`
- `{{3}}` approver name — `Aashiq Abu`
- `{{4}}` reason — `Duplicate of last week's invoice`

### Optional (only if you want these on WhatsApp too)

#### 3. `team_added` — Utility
```
OPM Flash: You've been added to the {{1}} team. Sign in at {{2}}/login.
```
(Keep sending the temp password by **email** — Meta is strict about credentials in templates.)

#### 4. `project_stage_update` — Utility
```
*OPM Flash* — {{1}} moved from {{2}} to {{3}} ({{4}}).
```

> Call sheets and the daily/briefing digests are intentionally **not**
> templated — they're long, multi-line, dynamic content that doesn't fit the
> fixed-variable template model and (for digests/news) wouldn't pass as Utility.
> They stay on email.

---

## Env vars to set (local `.env.local` + Vercel production)

```
TWILIO_WHATSAPP_FROM=whatsapp:+917736452777     # change from the sandbox number
TWILIO_TEMPLATE_NEW_BILL_SID=HXxxxxxxxxxxxxxxxx  # from approved new_bill_review
TWILIO_TEMPLATE_REJECTED_SID=HXxxxxxxxxxxxxxxxx  # from approved payment_rejected
```

The code already reads these (`lib/alerts/channels.ts` → `sendWhatsAppTemplate`,
wired in `app/api/whatsapp/inbound/route.ts`). Until the `*_SID` vars are set,
the app falls back to free-form text automatically — so nothing breaks while
templates are pending approval.

---

## Migration checklist (order matters)

1. ✅ Twilio account upgraded (Full type — done).
2. ⬜ Create a **Meta Business Manager** account at business.facebook.com (use OPM Cinemas' legal name + GST). Start **business verification** — it has the longest lead time.
3. ⬜ **Deregister** `+91 77364 52777` from the WhatsApp Business app on the phone (Settings → Account → Delete my account). ⚠️ This wipes that number's app inbox — point of no return.
4. ⬜ In **Twilio Console → Messaging → Senders → WhatsApp senders**, start the embedded signup, link the Meta Business Manager, register `+917736452777`, set the display name "OPM Cinemas", and complete the OTP sent to the number. Wait for status **ONLINE**.
5. ⬜ Submit templates 1 & 2 above; wait for Meta approval (~1 day).
6. ⬜ Point the sender's inbound webhook to `https://opmoffice.vercel.app/api/whatsapp/inbound` (POST).
7. ⬜ Set the three env vars above in local `.env.local` and Vercel production; redeploy.
8. ⬜ Live end-to-end test: send a bill photo from a staff WhatsApp → confirm draft created + approver gets the templated notification.

Steps 2–4 are actions only the account owner can do (phone + Meta login + OTP).
Steps 6–7 and template submission can be done together once the sender is ONLINE.
