export type Role = 'founder' | 'accountant' | 'general_manager' | 'executive_producer' | 'production_manager' | 'legal_viewer'

export type ProjectStatus = 'active' | 'development' | 'post_production' | 'released' | 'on_hold' | 'cancelled'

export type LiabilityType = 'loan' | 'vendor' | 'artist' | 'technician' | 'rent' | 'tax' | 'personal' | 'other'
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
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  slug: string
  status: ProjectStatus
  description?: string
  start_date?: string
  end_date?: string
  budget?: number
  created_by: string
  created_at: string
  updated_at: string
}

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
  project?: Pick<Project, 'name'>
  uploader?: Pick<Profile, 'full_name'>
  files?: DocumentFile[]
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
