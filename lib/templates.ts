// Built-in, printable standard formats. Each returns a self-contained HTML
// document the client opens for Print / Save-as-PDF or downloads. Agreements
// are clearly marked as drafts for legal review.

export interface TemplateCtx { project?: string }

export interface BuiltinTemplate {
  id: string
  name: string
  category: 'voucher' | 'agreement' | 'form'
  description: string
  build: (ctx?: TemplateCtx) => string
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
// A field that pre-fills with a value, or stays a blank line to write on.
function fill(value?: string): string {
  return value ? `<div class="line">${esc(value)}</div>` : '<div class="line">&nbsp;</div>'
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #18181b; margin: 0; padding: 32px 40px; font-size: 13px; line-height: 1.55; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 18px; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: 2px; }
  .sub { font-size: 11px; color:#555; }
  h1 { font-size: 15px; text-transform: uppercase; letter-spacing: 1px; text-align:center; margin: 4px 0 18px; }
  .row { display:flex; gap: 24px; margin-bottom: 10px; }
  .f { flex:1; }
  .lbl { font-size: 10px; text-transform: uppercase; color:#666; letter-spacing:.5px; }
  .line { border-bottom: 1px solid #999; min-height: 20px; padding: 2px 0; }
  table { width:100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #bbb; padding: 8px; text-align:left; font-size: 12px; }
  th { background:#f4f4f5; }
  .sig { display:flex; justify-content:space-between; margin-top: 48px; gap: 24px; }
  .sig .f { text-align:center; }
  .sig .line { border-bottom:1px solid #333; margin-bottom: 4px; }
  .draft { background:#fff7ed; border:1px solid #fdba74; color:#9a3412; padding:8px 12px; font-size:11px; border-radius:6px; margin-bottom:16px; }
  .clause { margin: 10px 0; }
  .clause b { display:inline-block; }
  p { margin: 8px 0; }
  @media print { body { padding: 20px; } }
`

function wrap(title: string, inner: string, project?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}${project ? ' — ' + esc(project) : ''}</title><style>${STYLE}</style></head>
<body>
  <div class="head">
    <div><div class="brand">OPM CINEMAS</div><div class="sub">${esc(title)}${project ? ` &middot; <b>${esc(project)}</b>` : ''}</div></div>
    <div class="sub" style="text-align:right">Ref No: ________<br/>Date: ____ / ____ / ______</div>
  </div>
  ${inner}</body></html>`
}

const L = '<div class="line">&nbsp;</div>'

function voucher(kind: string, received: string, project?: string): string {
  return wrap(kind, `
  <h1>${kind}</h1>
  <div class="row"><div class="f"><div class="lbl">${received} (Name)</div>${L}</div><div class="f"><div class="lbl">Project / Film</div>${fill(project)}</div></div>
  <div class="row"><div class="f"><div class="lbl">Department / Head</div>${L}</div><div class="f"><div class="lbl">Mode (Cash / UPI / Bank)</div>${L}</div></div>
  <table>
    <tr><th style="width:70%">Particulars</th><th>Amount (₹)</th></tr>
    <tr><td style="height:34px"></td><td></td></tr>
    <tr><td style="height:34px"></td><td></td></tr>
    <tr><td style="height:34px"></td><td></td></tr>
    <tr><th style="text-align:right">Total</th><th></th></tr>
  </table>
  <div class="row"><div class="f"><div class="lbl">Amount in words</div>${L}</div></div>
  <div class="row"><div class="f"><div class="lbl">Bill / Receipt attached?</div>${L}</div><div class="f"><div class="lbl">PAN / GSTIN (if applicable)</div>${L}</div></div>
  <div class="sig">
    <div class="f"><div class="line">&nbsp;</div>Prepared by</div>
    <div class="f"><div class="line">&nbsp;</div>${received}</div>
    <div class="f"><div class="line">&nbsp;</div>Approved by</div>
  </div>`, project)
}

function dealMemo(project?: string): string {
  return wrap('Deal Memo (Draft)', `
  <h1>Artist / Technician Deal Memo</h1>
  <div class="draft">DRAFT — for internal use. Have this reviewed and finalised by legal counsel before signing.</div>
  <p>This Deal Memo is made on ____ / ____ / ______ between <b>OPM Cinemas</b> ("Producer") and <b>[Name]</b> ("Artist/Technician"), [PAN], [Address]${project ? `, for the film <b>${esc(project)}</b>` : ''}.</p>
  <div class="row"><div class="f"><div class="lbl">Project / Film</div>${fill(project)}</div><div class="f"><div class="lbl">Role / Designation</div>${L}</div></div>
  <div class="row"><div class="f"><div class="lbl">Engagement Period (from – to)</div>${L}</div><div class="f"><div class="lbl">Working / Shoot Days</div>${L}</div></div>
  <div class="clause"><b>1. Fee:</b> Total remuneration of ₹__________ (Rupees ____________________), inclusive/exclusive of taxes, subject to applicable TDS.</div>
  <div class="clause"><b>2. Payment Schedule:</b> Advance ₹______ on signing; ₹______ on commencement; balance ₹______ on completion / delivery.</div>
  <div class="clause"><b>3. Scope:</b> The Artist/Technician shall render services as [role] for the Project as scheduled by the Producer.</div>
  <div class="clause"><b>4. Credit:</b> Credit as mutually agreed: ____________________.</div>
  <div class="clause"><b>5. Rights:</b> All work product and rights therein vest exclusively and perpetually in the Producer, worldwide.</div>
  <div class="clause"><b>6. Conduct:</b> Punctuality, confidentiality and professional conduct are essential conditions of this engagement.</div>
  <div class="clause"><b>7. Termination:</b> Either party may terminate for material breach with written notice; fees payable pro-rata for services rendered.</div>
  <div class="clause"><b>8. Governing Law:</b> Subject to the laws of India; jurisdiction at [City], Kerala.</div>
  <div class="sig">
    <div class="f"><div class="line">&nbsp;</div>For OPM Cinemas</div>
    <div class="f"><div class="line">&nbsp;</div>Artist / Technician</div>
  </div>`, project)
}

function purchaseOrder(project?: string): string {
  return wrap('Purchase Order', `
  <h1>Purchase Order</h1>
  <div class="row"><div class="f"><div class="lbl">Vendor / Supplier</div>${L}</div><div class="f"><div class="lbl">Project / Film</div>${fill(project)}</div></div>
  <div class="row"><div class="f"><div class="lbl">GSTIN</div>${L}</div><div class="f"><div class="lbl">Required by (date)</div>${L}</div></div>
  <table>
    <tr><th>#</th><th style="width:50%">Item / Service</th><th>Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr>
    <tr><td>1</td><td style="height:30px"></td><td></td><td></td><td></td></tr>
    <tr><td>2</td><td style="height:30px"></td><td></td><td></td><td></td></tr>
    <tr><td>3</td><td style="height:30px"></td><td></td><td></td><td></td></tr>
    <tr><th colspan="4" style="text-align:right">Sub-total</th><th></th></tr>
    <tr><th colspan="4" style="text-align:right">GST</th><th></th></tr>
    <tr><th colspan="4" style="text-align:right">Total</th><th></th></tr>
  </table>
  <div class="row"><div class="f"><div class="lbl">Delivery Address</div>${L}</div></div>
  <div class="row"><div class="f"><div class="lbl">Payment Terms</div>${L}</div></div>
  <div class="sig"><div class="f"><div class="line">&nbsp;</div>Authorised by (OPM Cinemas)</div><div class="f"><div class="line">&nbsp;</div>Vendor Acknowledgement</div></div>`, project)
}

function nda(project?: string): string {
  return wrap('Non-Disclosure Agreement (Draft)', `
  <h1>Mutual Non-Disclosure Agreement</h1>
  <div class="draft">DRAFT — for internal use. Have this reviewed and finalised by legal counsel before signing.</div>
  <p>This Agreement is entered into on ____ / ____ / ______ between <b>OPM Cinemas</b> and <b>[Counterparty Name]</b> ("the Parties")${project ? ` in connection with the film <b>${esc(project)}</b>` : ''}.</p>
  <div class="clause"><b>1. Confidential Information:</b> Any non-public information disclosed by either party — including scripts, budgets, casting, schedules, business and financial information — in any form.</div>
  <div class="clause"><b>2. Obligations:</b> The receiving party shall keep Confidential Information strictly confidential, use it solely for the agreed purpose, and not disclose it to third parties without prior written consent.</div>
  <div class="clause"><b>3. Exclusions:</b> Information that is public, independently developed, or lawfully received from a third party.</div>
  <div class="clause"><b>4. Term:</b> Confidentiality obligations survive for ____ years from the date of disclosure.</div>
  <div class="clause"><b>5. Return:</b> On request, all Confidential Information and copies shall be returned or destroyed.</div>
  <div class="clause"><b>6. Governing Law:</b> Subject to the laws of India; jurisdiction at [City], Kerala.</div>
  <div class="sig"><div class="f"><div class="line">&nbsp;</div>For OPM Cinemas</div><div class="f"><div class="line">&nbsp;</div>Counterparty</div></div>`, project)
}

function locationAgreement(project?: string): string {
  return wrap('Location Agreement (Draft)', `
  <h1>Location Hire Agreement</h1>
  <div class="draft">DRAFT — for internal use. Have this reviewed and finalised by legal counsel before signing.</div>
  <p>This Agreement is made on ____ / ____ / ______ between <b>OPM Cinemas</b> ("Producer") and <b>[Owner Name]</b> ("Owner") for use of the premises described below${project ? ` for the film <b>${esc(project)}</b>` : ''}.</p>
  <div class="row"><div class="f"><div class="lbl">Project / Film</div>${fill(project)}</div><div class="f"><div class="lbl">Location / Address</div>${L}</div></div>
  <div class="row"><div class="f"><div class="lbl">Hire Period (from – to)</div>${L}</div><div class="f"><div class="lbl">Hire Charges (₹)</div>${L}</div></div>
  <div class="clause"><b>1. Use:</b> The Owner permits the Producer to use the premises for filming, including equipment, cast and crew, during the hire period.</div>
  <div class="clause"><b>2. Condition & Damage:</b> The Producer shall return the premises in the same condition; reasonable wear excepted; making good any damage caused.</div>
  <div class="clause"><b>3. Rights:</b> All footage shot at the location vests exclusively in the Producer worldwide and in perpetuity, free of any claim by the Owner.</div>
  <div class="clause"><b>4. Indemnity & Insurance:</b> The Producer holds the Owner harmless against third-party claims arising from the Producer's filming activities.</div>
  <div class="clause"><b>5. Governing Law:</b> Subject to the laws of India; jurisdiction at [City], Kerala.</div>
  <div class="sig"><div class="f"><div class="line">&nbsp;</div>For OPM Cinemas</div><div class="f"><div class="line">&nbsp;</div>Owner</div></div>`, project)
}

function appointmentLetter(project?: string): string {
  return wrap('Crew Appointment Letter', `
  <h1>Letter of Engagement — Crew</h1>
  <p style="text-align:right">Date: ____ / ____ / ______</p>
  <p>To,<br/><b>[Name]</b><br/>[Address]</p>
  <p>Dear [Name],</p>
  <p>We are pleased to engage you on the production${project ? ` of <b>${esc(project)}</b>` : ''} on the terms below.</p>
  <div class="row"><div class="f"><div class="lbl">Project / Film</div>${fill(project)}</div><div class="f"><div class="lbl">Designation</div>${L}</div></div>
  <div class="row"><div class="f"><div class="lbl">Engagement Period</div>${L}</div><div class="f"><div class="lbl">Remuneration (₹)</div>${L}</div></div>
  <div class="clause"><b>1. Duties:</b> You shall perform the duties of your designation diligently and as directed by the Producer / department head.</div>
  <div class="clause"><b>2. Payment:</b> Remuneration as above, subject to applicable TDS; paid as per the agreed schedule.</div>
  <div class="clause"><b>3. Confidentiality:</b> You shall keep all production information confidential during and after the engagement.</div>
  <div class="clause"><b>4. Conduct & Safety:</b> Punctuality, professional conduct and adherence to on-set safety norms are conditions of this engagement.</div>
  <div class="clause"><b>5. Termination:</b> Either party may terminate for material breach with written notice; dues payable pro-rata.</div>
  <p>Kindly sign and return a copy in acceptance.</p>
  <div class="sig"><div class="f"><div class="line">&nbsp;</div>For OPM Cinemas</div><div class="f"><div class="line">&nbsp;</div>Accepted — Crew Member</div></div>`, project)
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { id: 'cash-voucher', name: 'Cash Payment Voucher', category: 'voucher', description: 'Standard cash payment voucher with particulars and sign-off.', build: (c) => voucher('Cash Payment Voucher', 'Paid To', c?.project) },
  { id: 'petty-cash-voucher', name: 'Petty Cash Voucher', category: 'voucher', description: 'For on-set petty-cash expenses against a head.', build: (c) => voucher('Petty Cash Voucher', 'Paid To', c?.project) },
  { id: 'receipt-voucher', name: 'Receipt Voucher', category: 'voucher', description: 'Acknowledge money received, with amount in words.', build: (c) => voucher('Receipt Voucher', 'Received From', c?.project) },
  { id: 'purchase-order', name: 'Purchase Order', category: 'form', description: 'Vendor PO with line items, GST and terms.', build: (c) => purchaseOrder(c?.project) },
  { id: 'deal-memo', name: 'Artist / Technician Deal Memo', category: 'agreement', description: 'Draft engagement memo — fee, schedule, rights. For legal review.', build: (c) => dealMemo(c?.project) },
  { id: 'appointment-letter', name: 'Crew Appointment Letter', category: 'agreement', description: 'Letter of engagement for crew — duties, pay, confidentiality.', build: (c) => appointmentLetter(c?.project) },
  { id: 'location-agreement', name: 'Location Agreement', category: 'agreement', description: 'Location hire agreement — period, charges, rights, indemnity.', build: (c) => locationAgreement(c?.project) },
  { id: 'nda', name: 'Non-Disclosure Agreement', category: 'agreement', description: 'Draft mutual NDA. For legal review.', build: (c) => nda(c?.project) },
]
