-- ─────────────────────────────────────────────
-- PURCHASE ORDERS + VENDOR ADVANCES — the "money in the field" ledger
-- Phase 1, step 2 of the production cost engine.
-- The biggest pre-prod gap: art dept pays large advances (Kaali: ₹27L) BEFORE
-- anything is delivered — money spent ≠ materials received (yet).
--
-- ONE-TRUTH / NO-DOUBLE-COUNT RULE (same as daily_cost_reports — read before changing):
--   Budget *actuals* come ONLY from the payment pipeline (paid payment_requests +
--   expense project_transactions + crew_payments) summed by budget_line_id on read.
--     • purchase_orders.order_amount is a COMMITMENT / forecast — a PO raised is not
--       money spent. It is NEVER summed into actual.
--     • vendor_advances.amount is a TRACKING figure for "money in the field"
--       (outstanding = paid-but-not-yet-delivered). The actual disbursement is the
--       payment_request that paid it; the advance row links to that payment via the
--       DORMANT `payment_request_id` bridge. The advance is NEVER summed into actual.
--   budget_line_id on a PO is for CATEGORISATION only (commitment-vs-estimate views).
--   `payment_request_id` is additive and inert in this migration — no query reads it
--   into any actual/spent sum. It is lit up only when a reconciliation view is built.
--
-- RLS: read = operational management (founder/accountant/GM/EP) so production
-- leadership can see the advances dashboard; write = is_finance() (founder+accountant),
-- because committing/disbursing money is a finance-controlled action; delete = founder.
-- Run in the Supabase SQL editor or via the pg client.
-- ─────────────────────────────────────────────

-- ── Purchase Orders: raise → approve → vendor confirms → deliver → close ──
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  po_number TEXT,                       -- human reference, assignable
  department TEXT,                      -- art / costume / camera / production / …
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'raised', 'approved', 'confirmed', 'partial', 'delivered', 'closed', 'cancelled'
  )),
  order_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- COMMITMENT, never an actual
  budget_line_id UUID REFERENCES budget_lines(id) ON DELETE SET NULL, -- categorisation only
  expected_delivery_date DATE,
  raised_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_po_project ON purchase_orders(project_id, status);
CREATE INDEX IF NOT EXISTS idx_po_vendor  ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_budget  ON purchase_orders(budget_line_id);

-- ── Vendor Advances: money paid out before delivery, tracked till closed ──
CREATE TABLE IF NOT EXISTS vendor_advances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL, -- "against what PO"
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,        -- tracked "in the field"; never an actual
  paid_date DATE,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'advance_paid' CHECK (status IN (
    'advance_paid', 'partial_delivery', 'full_delivery', 'balance_paid', 'closed'
  )),
  -- DORMANT settlement bridge to the payment pipeline (the real actual). NULL until linked.
  payment_request_id UUID REFERENCES payment_requests(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_va_project ON vendor_advances(project_id, status);
CREATE INDEX IF NOT EXISTS idx_va_vendor  ON vendor_advances(vendor_id);
CREATE INDEX IF NOT EXISTS idx_va_po      ON vendor_advances(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_va_payment ON vendor_advances(payment_request_id);

-- ── updated_at triggers ──
DROP TRIGGER IF EXISTS set_updated_at_po ON purchase_orders;
CREATE TRIGGER set_updated_at_po BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_va ON vendor_advances;
CREATE TRIGGER set_updated_at_va BEFORE UPDATE ON vendor_advances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS — read: management roles; write: finance only; delete: founder ──
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_read"   ON purchase_orders;
DROP POLICY IF EXISTS "po_insert" ON purchase_orders;
DROP POLICY IF EXISTS "po_update" ON purchase_orders;
DROP POLICY IF EXISTS "po_delete" ON purchase_orders;
CREATE POLICY "po_read"   ON purchase_orders FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "po_delete" ON purchase_orders FOR DELETE TO authenticated USING (public.is_founder());

DROP POLICY IF EXISTS "va_read"   ON vendor_advances;
DROP POLICY IF EXISTS "va_insert" ON vendor_advances;
DROP POLICY IF EXISTS "va_update" ON vendor_advances;
DROP POLICY IF EXISTS "va_delete" ON vendor_advances;
CREATE POLICY "va_read"   ON vendor_advances FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "va_insert" ON vendor_advances FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "va_update" ON vendor_advances FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "va_delete" ON vendor_advances FOR DELETE TO authenticated USING (public.is_founder());
