# OPM Office (Antigravity & Claude Code Workspace)

This workspace is shared by **Google Antigravity** (your visual IDE assistant) and **Claude Code** (your terminal reasoning CLI).

## Tech Stack & Commands
- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 (Dark-mode-first)
- **Database/Backend:** Supabase (Auth, PostgreSQL, Storage)
- **Start dev server:** `npm run dev`
- **Lint check:** `npm run lint`
- **Build project:** `npm run build`

## Project Structure
- `app/` — Protected routes under `(app)/` (dashboard, cash, liabilities, payments, documents, projects, reports, users, settings)
- `components/` — Shared UI elements (`ui/`, `layout/`)
- `lib/` — Supabase clients, TypeScript types, and utilities
- `supabase/` — Database schema, seed data, and migration files

## Code Style & Rules
- **Coding:** Use modern React and TypeScript conventions. Always prefer server actions/components where appropriate, and keep client components minimal.
- **Styling:** Follow the existing Tailwind v4 dark-mode patterns.
- **Security:** Respect Row Level Security (RLS) policies. Financial tables (cash, liabilities) are restricted to Founder + Accountant.
- **Audit Logs:** Every modifications to payments, cash, documents, or settings must log an audit entry using the helper in `lib/audit.ts`.
