// Built-in, printable standard formats. Each returns a self-contained HTML
// document the client opens for Print / Save-as-PDF or downloads. Agreements
// are clearly marked as drafts for legal review.

export interface BuiltinTemplate {
  id: string
  name: string
  category: 'voucher' | 'agreement' | 'form'
  description: string
  build: () => string
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

function wrap(title: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head>
<body>
  <div class="head">
    <div><div class="brand">OPM CINEMAS</div><div class="sub">${title}</div></div>
    <div class="sub" style="text-align:right">Voucher / Ref No: ________<br/>Date: ____ / ____ / ______</div>
  </div>
  ${inner}
</body></html>`
}

const L = '<div class="line">&nbsp;</div>'

function voucher(kind: string, received: string): string {
  return wrap(kind, `
  <h1>${kind}</h1>
  <div class="row"><div class="f"><div class="lbl">${received} (Name)</div>${L}</div><div class="f"><div class="lbl">Project / Film</div>${L}</div></div>
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
  </div>`)
}

function dealMemo(): string {
  return wrap('Deal Memo (Draft)', `
  <h1>Artist / Technician Deal Memo</h1>
  <div class="draft">DRAFT — for internal use. Have this reviewed and finalised by legal counsel before signing.</div>
  <p>This Deal Memo is made on ____ / ____ / ______ between <b>OPM Cinemas</b> ("Producer") and <b>[Name]</b> ("Artist/Technician"), [PAN], [Address].</p>
  <div class="row"><div class="f"><div class="lbl">Project / Film</div>${L}</div><div class="f"><div class="lbl">Role / Designation</div>${L}</div></div>
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
  </div>`)
}

function purchaseOrder(): string {
  return wrap('Purchase Order', `
  <h1>Purchase Order</h1>
  <div class="row"><div class="f"><div class="lbl">Vendor / Supplier</div>${L}</div><div class="f"><div class="lbl">Project / Film</div>${L}</div></div>
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
  <div class="sig"><div class="f"><div class="line">&nbsp;</div>Authorised by (OPM Cinemas)</div><div class="f"><div class="line">&nbsp;</div>Vendor Acknowledgement</div></div>`)
}

function nda(): string {
  return wrap('Non-Disclosure Agreement (Draft)', `
  <h1>Mutual Non-Disclosure Agreement</h1>
  <div class="draft">DRAFT — for internal use. Have this reviewed and finalised by legal counsel before signing.</div>
  <p>This Agreement is entered into on ____ / ____ / ______ between <b>OPM Cinemas</b> and <b>[Counterparty Name]</b> ("the Parties").</p>
  <div class="clause"><b>1. Confidential Information:</b> Any non-public information disclosed by either party — including scripts, budgets, casting, schedules, business and financial information — in any form.</div>
  <div class="clause"><b>2. Obligations:</b> The receiving party shall keep Confidential Information strictly confidential, use it solely for the agreed purpose, and not disclose it to third parties without prior written consent.</div>
  <div class="clause"><b>3. Exclusions:</b> Information that is public, independently developed, or lawfully received from a third party.</div>
  <div class="clause"><b>4. Term:</b> Confidentiality obligations survive for ____ years from the date of disclosure.</div>
  <div class="clause"><b>5. Return:</b> On request, all Confidential Information and copies shall be returned or destroyed.</div>
  <div class="clause"><b>6. Governing Law:</b> Subject to the laws of India; jurisdiction at [City], Kerala.</div>
  <div class="sig"><div class="f"><div class="line">&nbsp;</div>For OPM Cinemas</div><div class="f"><div class="line">&nbsp;</div>Counterparty</div></div>`)
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { id: 'cash-voucher', name: 'Cash Payment Voucher', category: 'voucher', description: 'Standard cash payment voucher with particulars and sign-off.', build: () => voucher('Cash Payment Voucher', 'Paid To') },
  { id: 'petty-cash-voucher', name: 'Petty Cash Voucher', category: 'voucher', description: 'For on-set petty-cash expenses against a head.', build: () => voucher('Petty Cash Voucher', 'Paid To') },
  { id: 'receipt-voucher', name: 'Receipt Voucher', category: 'voucher', description: 'Acknowledge money received, with amount in words.', build: () => voucher('Receipt Voucher', 'Received From') },
  { id: 'purchase-order', name: 'Purchase Order', category: 'form', description: 'Vendor PO with line items, GST and terms.', build: purchaseOrder },
  { id: 'deal-memo', name: 'Artist / Technician Deal Memo', category: 'agreement', description: 'Draft engagement memo — fee, schedule, rights. For legal review.', build: dealMemo },
  { id: 'nda', name: 'Non-Disclosure Agreement', category: 'agreement', description: 'Draft mutual NDA. For legal review.', build: nda },
]
