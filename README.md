# OPM Office

Internal office operating system for OPM Cinemas. A founder-first visual dashboard for company status at a glance.

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Supabase** (Auth, PostgreSQL, Storage)
- Dark-mode-first design

## Features

| Module | Description |
|---|---|
| **Dashboard** | Visual cards for cash, liabilities, pending approvals, expiring agreements, projects |
| **Cash in Hand** | Daily cash entry with proof attachments, safety-status indicators |
| **Liabilities** | Track all dues with progress bars, payment history, priority flags |
| **Payment Requests** | Full approval workflow: submit → verify → approve → pay |
| **Document Vault** | Store contracts, agreements, bills with expiry alerts |
| **Projects** | Per-project pages with documents, payments, liabilities |
| **Reports** | Cash, liability, payment, document reports with CSV export |
| **User Management** | Role-based access control with 5 roles |
| **Settings** | Profile management + append-only audit log |

## Roles & Access

| Role | Access |
|---|---|
| **Founder** | Full access to everything |
| **Accountant** | Finance, cash, liabilities, payments, reports |
| **Executive Producer** | Project documents, payment request status |
| **Production Manager** | Upload bills/documents, create payment requests |
| **Legal / CA Viewer** | Read-only documents and reports |

---

## Setup

### 1. Clone & Install

```bash
git clone <repo>
cd opm-office
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **Anon Key** from Settings → API

### 3. Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Database Schema

In Supabase Dashboard → **SQL Editor**, run these files in order:

1. `supabase/schema.sql` — Tables, indexes, triggers
2. `supabase/rls.sql` — Row Level Security policies
3. `supabase/seed.sql` — Default projects + storage bucket

### 5. Create Storage Bucket

In Supabase Dashboard → **Storage**:
- Create a bucket named `documents`
- Set it to **Private** (not public)
- The seed.sql also attempts this automatically

### 6. Create First User (Founder)

In Supabase Dashboard → **Authentication → Users**:
1. Click **Invite User** → enter the founder's email
2. After sign-up, run this SQL to set the role:
```sql
UPDATE profiles SET role = 'founder' WHERE email = 'founder@opmcinemas.com';
```

### 7. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Adding More Users

1. In Supabase Auth → Invite User (or they sign up)
2. A profile row is auto-created with `production_manager` role
3. Founder logs in → **Users** page → change role as needed

---

## File Structure

```
app/
├── (app)/                  # Protected app shell
│   ├── layout.tsx          # Auth check + AppShell
│   ├── dashboard/          # Founder overview
│   ├── cash/               # Cash in hand
│   ├── liabilities/        # Outstanding dues
│   ├── payments/           # Payment request workflow
│   ├── documents/          # Document vault
│   ├── projects/           # Projects + [id] detail pages
│   ├── reports/            # Reports + CSV export
│   ├── users/              # User management
│   └── settings/           # Profile + audit log
├── login/                  # Login page
components/
├── layout/                 # Sidebar, Header, AppShell
├── ui/                     # StatCard, StatusBadge, ProgressBar, Modal, Button, Input
lib/
├── supabase/               # client.ts, server.ts
├── types/                  # TypeScript interfaces
├── utils.ts                # Formatting, helpers
└── audit.ts                # Audit logging helper
supabase/
├── schema.sql              # All tables + triggers
├── rls.sql                 # Row level security
└── seed.sql                # Default data
```

---

## Security Notes

- All financial tables (cash, liabilities) restricted to Founder + Accountant via RLS
- Audit logs are append-only — enforced by both RLS (no DELETE policy) and a DB trigger
- No financial record can be permanently deleted without Founder visibility
- Document access is controlled by `access_level` field + project assignment
- Every create/edit/delete/approve/upload action is logged to `audit_logs`

---

## Default Projects

These are seeded automatically:
- OPM Office
- Aja Sundari
- Downtrodden
- Mayavi
- Rifle Club 2
- TOMORROW
- Other
