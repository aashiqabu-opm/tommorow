-- ─────────────────────────────────────────────
-- STORE & INVENTORY (Phase 3)
-- Dept-wise on-set store with the perishable-materials flag (palm fronds can't be
-- bought 3 days early). store_items holds current stock + reorder level; every
-- movement is logged in consumption_logs (purchase / consumption / adjustment).
--
-- quantity_on_hand is maintained as the live stock figure; consumption_logs is the
-- movement history. (Inventory stock, not a financial actual — material SPEND still
-- flows through the payment pipeline / Procurement; one-truth intact.)
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  department TEXT,                     -- art / costume / production / catering / …
  unit TEXT,                           -- bundles / poles / kg / litres / sheets / pcs
  quantity_on_hand NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12, 2),        -- alert threshold
  is_perishable BOOLEAN NOT NULL DEFAULT FALSE,
  shelf_life_days INT,                 -- for perishables (day-of purchase only)
  supplier TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_items_project ON store_items(project_id, department);

CREATE TABLE IF NOT EXISTS consumption_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_item_id UUID NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, -- denormalised for RLS/queries
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  change_type TEXT NOT NULL DEFAULT 'consumption' CHECK (change_type IN ('purchase', 'consumption', 'adjustment')),
  quantity NUMERIC(12, 2) NOT NULL,    -- signed delta applied to stock
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consumption_logs_item ON consumption_logs(store_item_id, log_date DESC);

DROP TRIGGER IF EXISTS set_updated_at_store_items ON store_items;
CREATE TRIGGER set_updated_at_store_items BEFORE UPDATE ON store_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE store_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_read"   ON store_items;
DROP POLICY IF EXISTS "store_insert" ON store_items;
DROP POLICY IF EXISTS "store_update" ON store_items;
DROP POLICY IF EXISTS "store_delete" ON store_items;
CREATE POLICY "store_read"   ON store_items FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "store_insert" ON store_items FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "store_update" ON store_items FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "store_delete" ON store_items FOR DELETE TO authenticated USING (public.is_founder());

DROP POLICY IF EXISTS "consumption_read"   ON consumption_logs;
DROP POLICY IF EXISTS "consumption_insert" ON consumption_logs;
DROP POLICY IF EXISTS "consumption_update" ON consumption_logs;
DROP POLICY IF EXISTS "consumption_delete" ON consumption_logs;
CREATE POLICY "consumption_read"   ON consumption_logs FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "consumption_insert" ON consumption_logs FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "consumption_update" ON consumption_logs FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "consumption_delete" ON consumption_logs FOR DELETE TO authenticated USING (public.is_founder());
