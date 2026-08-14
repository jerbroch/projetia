-- Job billing: material catalog, labor rates, billing sheets, invoice linkage

CREATE TYPE labor_rate_type AS ENUM ('regular', 'overtime', 'double_time');
CREATE TYPE billing_line_type AS ENUM ('labor', 'material');
CREATE TYPE billing_sheet_status AS ENUM ('draft', 'invoiced');

-- Company default material margin (40%)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS default_material_margin NUMERIC(5, 4) NOT NULL DEFAULT 0.40;

-- Suppliers (per company)
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_suppliers_company ON suppliers (company_id);

-- Material categories (global seed + company custom)
CREATE TABLE material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_material_categories_company ON material_categories (company_id);
CREATE UNIQUE INDEX idx_material_categories_slug_global ON material_categories (slug) WHERE company_id IS NULL;
CREATE UNIQUE INDEX idx_material_categories_slug_company ON material_categories (company_id, slug) WHERE company_id IS NOT NULL;

-- Requires pg_trgm for search (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Material catalog items
CREATE TABLE material_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies (id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES material_categories (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  diameter TEXT,
  fitting_type TEXT,
  unit TEXT NOT NULL DEFAULT 'unité',
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  search_text TEXT GENERATED ALWAYS AS (
    lower(
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(diameter, '') || ' ' ||
      coalesce(fitting_type, '')
    )
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER material_catalog_items_updated_at
  BEFORE UPDATE ON material_catalog_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_material_catalog_company ON material_catalog_items (company_id);
CREATE INDEX idx_material_catalog_category ON material_catalog_items (category_id);
CREATE INDEX idx_material_catalog_search ON material_catalog_items USING gin (search_text gin_trgm_ops);

-- Supplier pricing per catalog item
CREATE TABLE material_supplier_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES material_catalog_items (id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  sku TEXT,
  unit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  sell_price NUMERIC(12, 4),
  margin_pct NUMERIC(5, 4),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, catalog_item_id, supplier_id)
);

CREATE INDEX idx_material_supplier_prices_company ON material_supplier_prices (company_id);
CREATE INDEX idx_material_supplier_prices_catalog ON material_supplier_prices (catalog_item_id);
CREATE INDEX idx_material_supplier_prices_supplier ON material_supplier_prices (supplier_id);

-- Price history when supplier cost changes
CREATE TABLE material_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES material_catalog_items (id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  old_cost NUMERIC(12, 4) NOT NULL,
  new_cost NUMERIC(12, 4) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_material_price_history_item ON material_price_history (catalog_item_id, changed_at DESC);

-- Labor rate templates (company presets)
CREATE TABLE labor_rate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  worker_count INTEGER NOT NULL DEFAULT 1,
  cost_per_hr NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bill_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  margin_pct NUMERIC(5, 4),
  rate_type labor_rate_type NOT NULL DEFAULT 'regular',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER labor_rate_templates_updated_at
  BEFORE UPDATE ON labor_rate_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_labor_rate_templates_company ON labor_rate_templates (company_id, sort_order);

-- Job billing sheet (one per job)
CREATE TABLE job_billing_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  scheduled_job_id UUID NOT NULL REFERENCES scheduled_jobs (id) ON DELETE CASCADE,
  status billing_sheet_status NOT NULL DEFAULT 'draft',
  material_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  qst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  invoice_id UUID REFERENCES invoices (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, scheduled_job_id)
);

CREATE TRIGGER job_billing_sheets_updated_at
  BEFORE UPDATE ON job_billing_sheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_job_billing_sheets_job ON job_billing_sheets (scheduled_job_id);

-- Billing line items (labor + material)
CREATE TABLE job_billing_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_sheet_id UUID NOT NULL REFERENCES job_billing_sheets (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  line_type billing_line_type NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  unit_sell_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
  margin_pct NUMERIC(5, 4),
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor_template_id UUID REFERENCES labor_rate_templates (id) ON DELETE SET NULL,
  catalog_item_id UUID REFERENCES material_catalog_items (id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers (id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER job_billing_lines_updated_at
  BEFORE UPDATE ON job_billing_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_job_billing_lines_sheet ON job_billing_lines (billing_sheet_id, sort_order);

-- Extend invoices for job billing linkage and snapshots
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS scheduled_job_id UUID REFERENCES scheduled_jobs (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_number TEXT,
  ADD COLUMN IF NOT EXISTS client_po_number TEXT,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS material_subtotal NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_subtotal NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qst_amount NUMERIC(12, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoices_scheduled_job ON invoices (scheduled_job_id);

-- RLS (idempotent — safe to re-run)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_supplier_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_rate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_billing_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_billing_lines ENABLE ROW LEVEL SECURITY;

-- suppliers: strict company isolation (no global rows)
DROP POLICY IF EXISTS suppliers_company_isolation ON suppliers;
CREATE POLICY suppliers_company_isolation ON suppliers
  FOR ALL TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- material_categories: read global seed + own company; write own company only
DROP POLICY IF EXISTS material_categories_select ON material_categories;
DROP POLICY IF EXISTS material_categories_manage ON material_categories;
DROP POLICY IF EXISTS material_categories_insert ON material_categories;
DROP POLICY IF EXISTS material_categories_update ON material_categories;
DROP POLICY IF EXISTS material_categories_delete ON material_categories;
CREATE POLICY material_categories_select ON material_categories
  FOR SELECT TO authenticated
  USING (
    company_id IS NULL OR company_id IN (SELECT auth_user_company_ids())
  );
CREATE POLICY material_categories_insert ON material_categories
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));
CREATE POLICY material_categories_update ON material_categories
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));
CREATE POLICY material_categories_delete ON material_categories
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()));

-- material_catalog_items: read global catalog + own company; write own company only
DROP POLICY IF EXISTS material_catalog_items_select ON material_catalog_items;
DROP POLICY IF EXISTS material_catalog_items_manage ON material_catalog_items;
DROP POLICY IF EXISTS material_catalog_items_insert ON material_catalog_items;
DROP POLICY IF EXISTS material_catalog_items_update ON material_catalog_items;
DROP POLICY IF EXISTS material_catalog_items_delete ON material_catalog_items;
CREATE POLICY material_catalog_items_select ON material_catalog_items
  FOR SELECT TO authenticated
  USING (
    company_id IS NULL OR company_id IN (SELECT auth_user_company_ids())
  );
CREATE POLICY material_catalog_items_insert ON material_catalog_items
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));
CREATE POLICY material_catalog_items_update ON material_catalog_items
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));
CREATE POLICY material_catalog_items_delete ON material_catalog_items
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()));

-- supplier costs / price history: strict company isolation
DROP POLICY IF EXISTS material_supplier_prices_company_isolation ON material_supplier_prices;
CREATE POLICY material_supplier_prices_company_isolation ON material_supplier_prices
  FOR ALL TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

DROP POLICY IF EXISTS material_price_history_company_isolation ON material_price_history;
CREATE POLICY material_price_history_company_isolation ON material_price_history
  FOR ALL TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- labor_rate_templates: strict company isolation
DROP POLICY IF EXISTS labor_rate_templates_company_isolation ON labor_rate_templates;
CREATE POLICY labor_rate_templates_company_isolation ON labor_rate_templates
  FOR ALL TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- job billing sheets/lines: strict company isolation
DROP POLICY IF EXISTS job_billing_sheets_company_isolation ON job_billing_sheets;
CREATE POLICY job_billing_sheets_company_isolation ON job_billing_sheets
  FOR ALL TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

DROP POLICY IF EXISTS job_billing_lines_company_isolation ON job_billing_lines;
CREATE POLICY job_billing_lines_company_isolation ON job_billing_lines
  FOR ALL TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- Seed global material categories (plumbing)
INSERT INTO material_categories (company_id, name, slug, sort_order) VALUES
  (NULL, 'Tuyau cuivre', 'tuyau-cuivre', 1),
  (NULL, 'Fittings cuivre', 'fittings-cuivre', 2),
  (NULL, 'PVC DWV', 'pvc-dwv', 3),
  (NULL, 'PVC pression', 'pvc-pression', 4),
  (NULL, 'CPVC', 'cpvc', 5),
  (NULL, 'ABS', 'abs', 6),
  (NULL, 'Fonte', 'fonte', 7),
  (NULL, 'Acier noir', 'acier-noir', 8),
  (NULL, 'Acier galvanisé', 'acier-galvanise', 9),
  (NULL, 'Stainless', 'stainless', 10),
  (NULL, 'PEX', 'pex', 11),
  (NULL, 'ProPress', 'propress', 12),
  (NULL, 'MegaPress', 'megapress', 13),
  (NULL, 'Fittings filetés', 'fittings-filetes', 14),
  (NULL, 'Fittings mécaniques', 'fittings-mecaniques', 15),
  (NULL, 'Victaulic', 'victaulic', 16),
  (NULL, 'Valves', 'valves', 17),
  (NULL, 'Clapets', 'clapets', 18),
  (NULL, 'Régulateurs', 'regulateurs', 19),
  (NULL, 'Drains', 'drains', 20),
  (NULL, 'Puisards', 'puisards', 21),
  (NULL, 'Pompes', 'pompes', 22),
  (NULL, 'Chauffe-eau', 'chauffe-eau', 23),
  (NULL, 'Chaudières', 'chaudieres', 24),
  (NULL, 'Robinets', 'robinets', 25),
  (NULL, 'Toilettes', 'toilettes', 26),
  (NULL, 'Lavabos', 'lavabos', 27),
  (NULL, 'Douches', 'douches', 28),
  (NULL, 'Supports', 'supports', 29),
  (NULL, 'Isolants', 'isolants', 30),
  (NULL, 'Gaz naturel', 'gaz-naturel', 31),
  (NULL, 'Accessoires', 'accessoires', 32),
  (NULL, 'Divers', 'divers', 33);

-- Minimal starter catalog items (global, no prices — costs via CSV/import)
INSERT INTO material_catalog_items (company_id, category_id, name, diameter, fitting_type, unit)
SELECT NULL, c.id, v.name, v.diameter, v.fitting_type, v.unit
FROM material_categories c
JOIN (VALUES
  ('tuyau-cuivre', 'Tuyau cuivre type L', '1/2"', NULL, 'pi'),
  ('tuyau-cuivre', 'Tuyau cuivre type L', '3/4"', NULL, 'pi'),
  ('tuyau-cuivre', 'Tuyau cuivre type L', '1"', NULL, 'pi'),
  ('tuyau-cuivre', 'Tuyau cuivre type L', '1-1/2"', NULL, 'pi'),
  ('tuyau-cuivre', 'Tuyau cuivre type L', '2"', NULL, 'pi'),
  ('fittings-cuivre', 'Coude 90° cuivre', '1/2"', 'coude 90', 'unité'),
  ('fittings-cuivre', 'Coude 90° cuivre', '3/4"', 'coude 90', 'unité'),
  ('fittings-cuivre', 'Té cuivre', '1/2"', 'tee', 'unité'),
  ('fittings-cuivre', 'Té cuivre', '3/4"', 'tee', 'unité'),
  ('fittings-cuivre', 'Coude 45° cuivre', '1/2"', 'coude 45', 'unité'),
  ('pvc-dwv', 'Tuyau PVC DWV', '1-1/2"', NULL, 'pi'),
  ('pvc-dwv', 'Tuyau PVC DWV', '2"', NULL, 'pi'),
  ('pvc-dwv', 'Tuyau PVC DWV', '3"', NULL, 'pi'),
  ('pvc-dwv', 'Tuyau PVC DWV', '4"', NULL, 'pi'),
  ('pvc-dwv', 'Coude 90° PVC DWV', '2"', 'coude 90', 'unité'),
  ('pvc-pression', 'Tuyau PVC pression', '1/2"', NULL, 'pi'),
  ('pvc-pression', 'Tuyau PVC pression', '3/4"', NULL, 'pi'),
  ('pex', 'Tuyau PEX-A', '1/2"', NULL, 'pi'),
  ('pex', 'Tuyau PEX-A', '3/4"', NULL, 'pi'),
  ('valves', 'Vanne à boisseau', '1/2"', NULL, 'unité'),
  ('valves', 'Vanne à boisseau', '3/4"', NULL, 'unité'),
  ('robinets', 'Robinet d''arrêt', '3/8"', NULL, 'unité'),
  ('divers', 'Ruban téflon', NULL, NULL, 'unité')
) AS v(slug, name, diameter, fitting_type, unit) ON c.slug = v.slug AND c.company_id IS NULL;

-- Function to seed default suppliers for a company
CREATE OR REPLACE FUNCTION seed_company_billing_defaults(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id NOT IN (SELECT auth_user_company_ids()) THEN
    RAISE EXCEPTION 'Unauthorized company';
  END IF;

  INSERT INTO suppliers (company_id, code, name) VALUES
    (p_company_id, 'noble', 'Noble'),
    (p_company_id, 'wolseley', 'Wolseley'),
    (p_company_id, 'deschenes', 'Deschênes'),
    (p_company_id, 'master', 'Master'),
    (p_company_id, 'autre', 'Autre')
  ON CONFLICT (company_id, code) DO NOTHING;
END;
$$;
