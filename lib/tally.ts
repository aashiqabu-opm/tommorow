// Tally export — generates Tally-compatible XML (and CSV) so the accountant can
// "Import Data" straight into TallyPrime / Tally.ERP 9. We target the common XML
// subset both accept. Read-only: this only produces files to download.

export interface TallyLine { ledger: string; dr: boolean; amount: number }

export interface TallyVoucher {
  date: string                 // YYYY-MM-DD
  type: string                 // Payment | Receipt | Contra | Journal | Sales | Purchase
  number?: string
  narration?: string
  partyLedger?: string
  lines: TallyLine[]           // every Dr/Cr leg; should net to zero
}

export interface TallyLedger { name: string; parent: string }

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function tdate(iso: string): string { return (iso || '').slice(0, 10).replace(/-/g, '') }
function amt(n: number): string { return (Math.round(Number(n || 0) * 100) / 100).toFixed(2) }

// ISDEEMEDPOSITIVE "Yes" = Debit (amount carried negative); "No" = Credit (positive)
function lineXml(l: TallyLine): string {
  return `        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${esc(l.ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${l.dr ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${l.dr ? '-' : ''}${amt(l.amount)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
}

function voucherXml(v: TallyVoucher): string {
  const lines = v.lines.filter(l => l.ledger && Number(l.amount) > 0).map(lineXml).join('\n')
  return `      <VOUCHER VCHTYPE="${esc(v.type)}" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${tdate(v.date)}</DATE>
        <EFFECTIVEDATE>${tdate(v.date)}</EFFECTIVEDATE>
        <VOUCHERTYPENAME>${esc(v.type)}</VOUCHERTYPENAME>
        ${v.number ? `<VOUCHERNUMBER>${esc(v.number)}</VOUCHERNUMBER>` : ''}
        ${v.partyLedger ? `<PARTYLEDGERNAME>${esc(v.partyLedger)}</PARTYLEDGERNAME>` : ''}
        <NARRATION>${esc(v.narration ?? '')}</NARRATION>
${lines}
      </VOUCHER>`
}

function envelope(company: string, report: string, inner: string): string {
  const sv = company ? `\n      <STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ''
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${report}</REPORTNAME>${sv}
      </REQUESTDESC>
      <REQUESTDATA>
${inner}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}

export function buildVoucherXml(vouchers: TallyVoucher[], company = ''): string {
  const msgs = vouchers.map(v => `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
${voucherXml(v)}
        </TALLYMESSAGE>`).join('\n')
  return envelope(company, 'Vouchers', msgs)
}

export function buildLedgerXml(ledgers: TallyLedger[], company = ''): string {
  const msgs = ledgers.map(l => `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${esc(l.name)}" ACTION="Create">
            <NAME>${esc(l.name)}</NAME>
            <PARENT>${esc(l.parent)}</PARENT>
          </LEDGER>
        </TALLYMESSAGE>`).join('\n')
  return envelope(company, 'All Masters', msgs)
}

// CSV in Tally daybook style — one row per ledger leg.
export function buildVoucherCsv(vouchers: TallyVoucher[]): string {
  const head = ['Date', 'Voucher Type', 'Voucher No', 'Ledger', 'Debit', 'Credit', 'Narration']
  const rows: string[] = []
  for (const v of vouchers) {
    const dmy = v.date.slice(0, 10).split('-').reverse().join('-') // DD-MM-YYYY
    for (const l of v.lines.filter(x => x.ledger && Number(x.amount) > 0)) {
      rows.push([dmy, v.type, v.number ?? '', l.ledger, l.dr ? amt(l.amount) : '', l.dr ? '' : amt(l.amount), (v.narration ?? '').replace(/[\r\n,]/g, ' ')]
        .map(c => /[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)).join(','))
    }
  }
  return [head.join(','), ...rows].join('\n')
}

// ── Helpers to assemble tax-split legs for an expense payment / income ───
export type GstSplit = 'cgst_sgst' | 'igst' | 'single'

// Standard Tally GST ledger names (parent: Duties & Taxes)
export const GST_LEDGERS = {
  input: { cgst: 'Input CGST', sgst: 'Input SGST', igst: 'Input IGST', single: 'Input GST' },
  output: { cgst: 'Output CGST', sgst: 'Output SGST', igst: 'Output IGST', single: 'Output GST' },
}

export interface GstTdsInput {
  party: string
  bankLedger: string
  gross: number              // total incl GST (the invoice amount)
  gstAmount?: number | null  // GST portion of gross
  tdsAmount?: number | null  // TDS withheld (on base)
  gstSplit: GstSplit
  tdsLedger?: string         // default 'TDS Payable'
}

function gstLegs(gst: number, split: GstSplit, income: boolean, dr: boolean): TallyLine[] {
  if (gst <= 0) return []
  const set = income ? GST_LEDGERS.output : GST_LEDGERS.input
  if (split === 'single') return [{ ledger: set.single, dr, amount: gst }]
  if (split === 'igst') return [{ ledger: set.igst, dr, amount: gst }]
  return [{ ledger: set.cgst, dr, amount: gst / 2 }, { ledger: set.sgst, dr, amount: gst / 2 }]
}

// Which GST/tax ledgers a set of vouchers touches (for the masters export).
export function gstLedgerNames(split: GstSplit, income: boolean): string[] {
  const set = income ? GST_LEDGERS.output : GST_LEDGERS.input
  if (split === 'single') return [set.single]
  if (split === 'igst') return [set.igst]
  return [set.cgst, set.sgst]
}

// Build the multi-leg lines for a payment (expense) with GST input + TDS.
export function expensePaymentLines(i: GstTdsInput): TallyLine[] {
  const gst = Number(i.gstAmount || 0)
  const tds = Number(i.tdsAmount || 0)
  const base = i.gross - gst
  const net = i.gross - tds
  const lines: TallyLine[] = [{ ledger: i.party, dr: true, amount: base }]
  lines.push(...gstLegs(gst, i.gstSplit, false, true)) // input GST debited
  if (tds > 0) lines.push({ ledger: i.tdsLedger || 'TDS Payable', dr: false, amount: tds }) // TDS payable credited
  lines.push({ ledger: i.bankLedger, dr: false, amount: net }) // bank credited (net paid)
  return lines
}

// Build the multi-leg lines for income received (output GST).
export function incomeReceiptLines(i: GstTdsInput): TallyLine[] {
  const gst = Number(i.gstAmount || 0)
  const base = i.gross - gst
  const lines: TallyLine[] = [{ ledger: i.bankLedger, dr: true, amount: i.gross }] // bank debited (received)
  lines.push({ ledger: i.party, dr: false, amount: base }) // income credited
  lines.push(...gstLegs(gst, i.gstSplit, true, false)) // output GST credited
  return lines
}
