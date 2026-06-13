// Tally export — generates Tally-compatible XML (and CSV) so the accountant can
// "Import Data" straight into TallyPrime / Tally.ERP 9. We target the common XML
// subset both accept. Read-only: this only produces files to download.

export interface TallyVoucher {
  date: string                 // YYYY-MM-DD
  type: 'Payment' | 'Receipt'
  number?: string
  narration?: string
  partyLedger: string          // expense/party (Payment) or income/party (Receipt)
  bankLedger: string           // bank or cash ledger
  amount: number               // positive rupees
}

export interface TallyLedger { name: string; parent: string }

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Tally wants dates as YYYYMMDD
function tdate(iso: string): string { return (iso || '').slice(0, 10).replace(/-/g, '') }
function amt(n: number): string { return (Math.round(Number(n || 0) * 100) / 100).toFixed(2) }

function ledgerEntry(name: string, deemedPositive: boolean, amount: number): string {
  // ISDEEMEDPOSITIVE "Yes" = Debit (amount carried negative); "No" = Credit (positive)
  return `        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${esc(name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${deemedPositive ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${deemedPositive ? '-' : ''}${amt(amount)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
}

function voucherXml(v: TallyVoucher): string {
  // Payment: Dr party/expense, Cr bank.  Receipt: Dr bank, Cr party/income.
  const partyDr = v.type === 'Payment'
  const entries = partyDr
    ? ledgerEntry(v.partyLedger, true, v.amount) + '\n' + ledgerEntry(v.bankLedger, false, v.amount)
    : ledgerEntry(v.bankLedger, true, v.amount) + '\n' + ledgerEntry(v.partyLedger, false, v.amount)
  return `      <VOUCHER VCHTYPE="${v.type}" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${tdate(v.date)}</DATE>
        <EFFECTIVEDATE>${tdate(v.date)}</EFFECTIVEDATE>
        <VOUCHERTYPENAME>${v.type}</VOUCHERTYPENAME>
        ${v.number ? `<VOUCHERNUMBER>${esc(v.number)}</VOUCHERNUMBER>` : ''}
        <PARTYLEDGERNAME>${esc(v.partyLedger)}</PARTYLEDGERNAME>
        <NARRATION>${esc(v.narration ?? '')}</NARRATION>
${entries}
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

// CSV in a Tally-friendly column order (for eyeballing / fallback import via Excel)
export function buildVoucherCsv(vouchers: TallyVoucher[]): string {
  const head = ['Date', 'Voucher Type', 'Voucher No', 'Party Ledger', 'Bank/Cash Ledger', 'Amount', 'Narration']
  const rows = vouchers.map(v => [
    v.date.slice(0, 10).split('-').reverse().join('-'), // DD-MM-YYYY
    v.type, v.number ?? '', v.partyLedger, v.bankLedger, amt(v.amount), (v.narration ?? '').replace(/[\r\n,]/g, ' '),
  ].map(c => /[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)).join(','))
  return [head.join(','), ...rows].join('\n')
}
