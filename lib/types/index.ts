export type Role = 'founder' | 'accountant' | 'general_manager' | 'executive_producer' | 'legal_viewer' | 'staff'

// Per-project core-team roles (stored on project_members.project_role)
export type ProjectRole =
  | 'director'
  | 'dop'
  | 'executive_producer'
  | 'general_manager'
  | 'finance_controller'
  | 'production_controller'
  | 'chief_ad'
  | 'associate_director'
  | 'screenwriter'
  | 'production_designer'
  | 'music_director'
  | 'editor'
  | 'assistant_editor'
  | 'sound_designer'
  | 'vfx_director'
  | 'colorist'
  | 'production_executive'
  | 'production_manager'
  | 'cashier'
  | 'purchase_manager'
  | 'location_manager'
  | 'driver'
  | 'production_assistant'
  | 'member'

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string | null
  project_role: ProjectRole
  title?: string | null
  team_group?: 'pre_production' | 'production' | 'post_production'
  member_name?: string | null
  member_email?: string | null
  member_phone?: string | null
  added_by?: string | null
  created_at: string
  // joined (present only when user_id links an app user)
  profile?: { id: string; full_name: string; email: string; role: Role } | null
}

export interface ProjectMessage {
  id: string
  project_id: string
  author_id: string
  body: string
  created_at: string
  author?: { full_name: string; role: Role } | null
}

export type ProjectPhase = 'development' | 'production' | 'post_production' | 'distribution' | 'release'

export interface PhaseTask {
  id: string
  project_id: string
  phase: ProjectPhase
  title: string
  done: boolean
  done_at?: string | null
  sort_order: number
  created_at: string
}

export interface BoxOfficeCollection {
  id: string
  project_id: string
  day_number: number | null
  collection_date: string
  india_net: number | null
  worldwide_gross: number | null
  screens: number | null
  occupancy: number | null
  source: string | null
  confirmed: boolean
  notes: string | null
  created_at: string
}

export interface MonitoringFinding {
  id: string
  project_id: string
  scan_date: string
  category: 'piracy' | 'reputation'
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string | null
  url: string | null
  dismissed: boolean
  created_at: string
}

export interface BankTransaction {
  id: string
  account_id: string | null
  txn_date: string
  description: string | null
  reference: string | null
  amount: number              // + deposit, - withdrawal
  matched_type: 'payment' | 'income' | 'manual' | null
  matched_id: string | null
  created_at: string
}

export interface Ledger {
  id: string
  name: string
  parent: string
  opening_balance: number
  created_at: string
}

export interface VoucherEntry {
  id?: string
  voucher_id?: string
  ledger_name: string
  dr: boolean
  amount: number
  sort_order?: number
}

export interface Voucher {
  id: string
  voucher_type: string
  voucher_date: string
  voucher_number: string | null
  narration: string | null
  source_type?: string | null   // 'payment' | 'income' when auto-generated
  source_id?: string | null
  created_at: string
  entries?: VoucherEntry[]
}

export interface CampaignAsset {
  id: string
  project_id: string
  asset_type: 'teaser' | 'trailer' | 'first_look' | 'poster' | 'song' | 'promo' | 'other'
  title: string
  url: string | null
  released_on: string | null
  ai_summary: string | null
  ai_metrics: { views?: string; likes?: string; comments?: string; trending?: string; sentiment?: string } | null
  last_checked: string | null
  created_at: string
}

export interface IndustryFilm {
  id: string
  title: string
  release_date: string | null
  days: { day: number; date: string | null; india_net: number | null; worldwide: number | null; source: string | null }[]
  ai_note: string | null
  total_india: number | null
  last_checked: string | null
  created_at: string
}

export interface ProjectCheckin {
  id: string
  project_id: string
  author_id: string
  checkin_date: string
  summary: string
  blockers?: string | null
  created_at: string
  // joined
  author?: { full_name: string; role: Role } | null
}

export type ProjectStatus = 'active' | 'development' | 'post_production' | 'released' | 'on_hold' | 'cancelled'

export type LiabilityType = 'loan' | 'vendor' | 'artist' | 'technician' | 'rent' | 'tax' | 'personal' | 'other' | 'salary'
export type LiabilityPriority = 'urgent' | 'normal' | 'low'
export type LiabilityStatus = 'unpaid' | 'partly_paid' | 'cleared' | 'disputed'

export type PaymentStatus = 'draft' | 'pending_verification' | 'verified' | 'pending_approval' | 'approved' | 'rejected' | 'paid'

export type DocumentType =
  | 'movie_agreement'
  | 'artist_contract'
  | 'technician_contract'
  | 'investor_agreement'
  | 'distribution_agreement'
  | 'ott_agreement'
  | 'music_rights'
  | 'legal_notice'
  | 'gst_tds'
  | 'invoice'
  | 'bill'
  | 'censor_document'
  | 'insurance'
  | 'loan_document'
  | 'company_registration'
  | 'other'

export type DocumentStatus = 'draft' | 'signed' | 'active' | 'expired' | 'disputed'
export type DocumentAccessLevel = 'founder_only' | 'finance_team' | 'project_team' | 'all_staff'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  avatar_url?: string
  is_active: boolean
  email_alerts?: boolean
  whatsapp_alerts?: boolean
  whatsapp_number?: string | null
  muted_categories?: string[]
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  slug: string
  status: ProjectStatus
  is_priority?: boolean
  description?: string
  start_date?: string
  end_date?: string
  budget?: number
  release_date?: string | null
  ai_status_reason?: string | null
  ai_status_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectIncome {
  id: string
  project_id: string
  amount: number
  source: string
  income_date: string
  notes?: string
  recorded_by: string
  created_at: string
  // Revenue / Collections fields
  party?: string | null
  territory?: string | null
  gross_amount?: number | null
  commission_amount?: number | null
  expected_date?: string | null
  status?: 'received' | 'receivable'
  gst_amount?: number | null
}

export const REVENUE_SOURCES = [
  { value: 'theatrical', label: 'Theatrical Collection' },
  { value: 'distributor_mg', label: 'Distributor MG / Minimum Guarantee' },
  { value: 'overflow', label: 'Overflow / Profit Share' },
  { value: 'ott', label: 'OTT / Streaming' },
  { value: 'satellite', label: 'Satellite Rights' },
  { value: 'music', label: 'Music Rights' },
  { value: 'advance', label: 'Producer Advance' },
  { value: 'investor', label: 'Investor Funding' },
  { value: 'other', label: 'Other' },
]

export const REVENUE_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  REVENUE_SOURCES.map(s => [s.value, s.label])
)

export interface CashEntry {
  id: string
  entry_date: string
  opening_cash: number
  cash_in: number
  cash_out: number
  closing_cash: number
  entered_by: string
  notes?: string
  proof_file_url?: string
  proof_file_name?: string
  created_at: string
  updated_at: string
  profile?: Pick<Profile, 'full_name'>
}

export interface Liability {
  id: string
  party_name: string
  amount_owed: number
  amount_paid: number
  balance_remaining: number
  original_date: string
  due_date?: string
  project_id?: string
  type: LiabilityType
  priority: LiabilityPriority
  status: LiabilityStatus
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
  project?: Pick<Project, 'name'>
  payment_history?: LiabilityPayment[]
}

export interface LiabilityPayment {
  id: string
  liability_id: string
  amount: number
  payment_date: string
  paid_by: string
  notes?: string
  receipt_url?: string
  created_at: string
  profile?: Pick<Profile, 'full_name'>
}

export interface PaymentRequest {
  id: string
  project_id: string
  requested_by: string
  payee: string
  amount: number
  purpose: string
  category: string
  due_date?: string
  bill_url?: string
  bill_file_name?: string
  verification_status: 'pending' | 'verified' | 'rejected'
  verified_by?: string
  verified_at?: string
  approval_status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  payment_status: 'unpaid' | 'paid'
  paid_by?: string
  paid_at?: string
  receipt_url?: string
  notes?: string
  created_at: string
  updated_at: string
  project?: Pick<Project, 'name'>
  requester?: Pick<Profile, 'full_name'>
  approver?: Pick<Profile, 'full_name'>
  payee_vendor_id?: string
  gst_amount?: number
  tds_percent?: number
  tds_amount?: number
  net_payable?: number
  budget_line_id?: string | null
  tds_section?: string | null
  vendor?: { pan?: string } | null
}

export interface Vendor {
  id: string
  name: string
  phone?: string
  email?: string
  gst_number?: string
  pan?: string
  bank_account_name?: string
  bank_account_number?: string
  bank_ifsc?: string
  upi_id?: string
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
  total_paid?: number
}

export interface Document {
  id: string
  project_id?: string
  document_type: DocumentType
  title: string
  party_name?: string
  document_date?: string
  expiry_date?: string
  renewal_date?: string
  amount_linked?: number
  status: DocumentStatus
  notes?: string
  uploaded_by: string
  access_level: DocumentAccessLevel
  created_at: string
  updated_at: string
  ai_summary?: string | null
  ai_analysis?: DocumentAnalysisData | null
  ai_analyzed_at?: string | null
  project?: Pick<Project, 'name'>
  uploader?: Pick<Profile, 'full_name'>
  files?: DocumentFile[]
}

export interface DocumentAnalysisData {
  summary: string
  doc_type: string
  parties: string[]
  key_dates: { label: string; date: string; kind: string }[]
  financial_terms: { label: string; amount: number | null; note: string }[]
  obligations: string[]
  flags: { severity: string; note: string }[]
}

export interface DocumentFile {
  id: string
  document_id: string
  file_name: string
  file_url: string
  file_size?: number
  uploaded_by: string
  uploaded_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  created_at: string
  profile?: Pick<Profile, 'full_name'>
}

export interface Comment {
  id: string
  entity_type: string
  entity_id: string
  user_id: string
  content: string
  created_at: string
  profile?: Pick<Profile, 'full_name'>
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body?: string
  is_read: boolean
  entity_type?: string
  entity_id?: string
  created_at: string
}

export interface BankAccount {
  id: string
  name: string
  account_type: 'bank' | 'upi' | 'cash_drawer'
  account_number?: string
  ifsc?: string
  opening_balance: number
  current_balance: number
  is_active: boolean
  created_at: string
  recent_transactions?: AccountTransaction[]
}

export interface AccountTransaction {
  id: string
  account_id: string
  txn_date: string
  direction: 'in' | 'out'
  amount: number
  description?: string
  reference?: string
  entity_type?: string
  entity_id?: string
  created_by?: string
  created_at: string
}

export interface StaffSalary {
  id: string
  person_name: string
  role_title?: string
  monthly_salary: number
  vendor_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  cash_in_hand: number
  bank_balance: number
  total_liabilities: number
  paid_liabilities: number
  pending_approvals: number
  missing_documents: number
  expiring_agreements: number
  projects: ProjectHealthCard[]
}

export interface ProjectHealthCard {
  id: string
  name: string
  status: ProjectStatus
  document_count: number
  pending_payments: number
  total_liabilities: number
  health: 'green' | 'yellow' | 'red'
}

export type FundingKind = 'investor' | 'loan' | 'opm'
export type FundingTxnType = 'capital_in' | 'payout' | 'interest_paid' | 'principal_repaid' | 'other'

export interface ProjectFunding {
  id: string
  project_id: string
  kind: FundingKind
  name: string
  amount: number
  equity_percent?: number | null
  interest_rate?: number | null
  interest_basis?: 'monthly' | 'annual'
  interest_method?: 'simple' | 'reducing'
  start_date?: string | null
  tenure_months?: number | null
  status: 'active' | 'closed'
  contact_person?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  notes?: string | null
  created_by?: string
  created_at: string
  updated_at: string
  transactions?: FundingTransaction[]
}

export interface FundingTransaction {
  id: string
  funding_id: string
  txn_date: string
  type: FundingTxnType
  amount: number
  notes?: string | null
  created_by?: string
  created_at: string
}

export const FUNDING_TXN_LABELS: Record<FundingTxnType, string> = {
  capital_in: 'Capital In',
  payout: 'Payout / Return',
  interest_paid: 'Interest Paid',
  principal_repaid: 'Principal Repaid',
  other: 'Other',
}

export type BudgetSection = 'above_line' | 'below_line' | 'post' | 'other'
export type BudgetPhase = 'development' | 'pre' | 'production' | 'post' | 'release'

export interface BudgetLine {
  id: string
  project_id: string
  section: BudgetSection
  phase: BudgetPhase
  head: string
  estimated: number
  notes?: string | null
  sort_order: number
  created_by?: string
  created_at: string
  updated_at: string
}

export type PettyCashTxnType = 'issue' | 'expense' | 'return'

export interface PettyCashFloat {
  id: string
  project_id: string
  holder_name: string
  holder_user_id?: string | null
  status: 'open' | 'closed'
  opened_date: string
  notes?: string | null
  created_by?: string
  created_at: string
  updated_at: string
  txns?: PettyCashTxn[]
}

export interface PettyCashTxn {
  id: string
  float_id: string
  txn_date: string
  type: PettyCashTxnType
  amount: number
  head?: string | null
  budget_line_id?: string | null
  description?: string | null
  created_by?: string
  created_at: string
}

export type CrewPaymentType = 'advance' | 'payment' | 'final'

export interface ProjectCrew {
  id: string
  project_id: string
  name: string
  role_title?: string | null
  agreed_fee: number
  tds_percent: number
  budget_line_id?: string | null
  phone?: string | null
  email?: string | null
  pan?: string | null
  status: 'active' | 'closed'
  notes?: string | null
  created_by?: string
  created_at: string
  updated_at: string
  payments?: CrewPayment[]
}

export interface CrewPayment {
  id: string
  crew_id: string
  amount: number
  payment_date: string
  type: CrewPaymentType
  notes?: string | null
  created_by?: string
  created_at: string
}

export type DPRStatus = 'on_schedule' | 'ahead' | 'behind'

export interface ProductionReport {
  id: string
  project_id: string
  report_date: string
  day_number?: number | null
  location?: string | null
  call_time?: string | null
  wrap_time?: string | null
  scenes_planned: number
  scenes_completed: number
  shots_completed?: number | null
  cast_present?: string | null
  crew_count?: number | null
  status: DPRStatus
  weather?: string | null
  notes?: string | null
  created_by?: string
  created_at: string
  updated_at: string
}

export type VehicleType = 'car' | 'van' | 'bus' | 'truck' | 'camera_vehicle' | 'generator' | 'bike' | 'other'
export type VehicleLogType = 'trip' | 'fuel' | 'service'

export interface Vehicle {
  id: string
  reg_number: string
  name?: string | null
  vehicle_type: VehicleType
  ownership: 'owned' | 'hired'
  owner_name?: string | null
  hire_rate?: number | null
  hire_basis?: 'day' | 'km' | 'month' | 'trip' | null
  driver_name?: string | null
  driver_phone?: string | null
  driver_union_id?: string | null
  driver_license_no?: string | null
  driver_license_expiry?: string | null
  owner_phone?: string | null
  project_id?: string | null
  status: 'active' | 'inactive'
  notes?: string | null
  created_by?: string
  created_at: string
  updated_at: string
  logs?: VehicleLog[]
  documents?: VehicleDocument[]
  project?: { name?: string } | null
}

export type VehicleDocType = 'rc' | 'insurance' | 'puc' | 'permit' | 'fitness' | 'tax' | 'other'

export interface VehicleDocument {
  id: string
  vehicle_id: string
  doc_type: VehicleDocType
  doc_number?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  file_url?: string | null
  file_name?: string | null
  notes?: string | null
  created_by?: string
  created_at: string
  updated_at: string
}

export const VEHICLE_DOC_LABELS: Record<VehicleDocType, string> = {
  rc: 'Registration (RC)', insurance: 'Insurance', puc: 'Pollution (PUC)',
  permit: 'Permit', fitness: 'Fitness Certificate', tax: 'Road Tax', other: 'Other',
}

export interface VehicleLog {
  id: string
  vehicle_id: string
  log_date: string
  type: VehicleLogType
  odometer_start?: number | null
  odometer_end?: number | null
  km?: number | null
  fuel_litres?: number | null
  amount: number
  purpose?: string | null
  driver_name?: string | null
  project_id?: string | null
  notes?: string | null
  created_by?: string
  created_at: string
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Car', van: 'Van', bus: 'Bus', truck: 'Truck',
  camera_vehicle: 'Camera Vehicle', generator: 'Generator', bike: 'Bike', other: 'Other',
}

export interface Template {
  id: string
  name: string
  category: 'voucher' | 'agreement' | 'form' | 'hr' | 'other'
  description?: string | null
  file_url: string
  file_name?: string | null
  file_size?: number | null
  created_by?: string
  created_at: string
}

// ── Personal / Founder module (Phase 1) ──
export interface PersonalLedgerEntry {
  id: string
  owner_id: string
  entity: string
  direction: 'to_company' | 'from_company'
  kind: 'loan' | 'capital' | 'drawing' | 'dividend' | 'repayment' | 'reimbursement'
  amount: number
  txn_date: string
  status: 'open' | 'settled'
  notes?: string | null
  created_at: string
}

export interface PersonalGuarantee {
  id: string
  owner_id: string
  lender: string
  borrower: string
  amount: number
  start_date?: string | null
  expiry_date?: string | null
  status: 'active' | 'released'
  notes?: string | null
  created_at: string
}

export interface PersonalAccount {
  id: string
  owner_id: string
  name: string
  type: 'bank' | 'cash' | 'wallet' | 'investment'
  balance: number
  notes?: string | null
  created_at: string
}

export const LEDGER_KIND_LABELS: Record<PersonalLedgerEntry['kind'], string> = {
  loan: 'Loan to company', capital: 'Capital introduced', drawing: 'Drawing',
  dividend: 'Dividend', repayment: 'Loan repayment', reimbursement: 'Reimbursement',
}
