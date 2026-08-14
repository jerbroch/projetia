-- Fix RLS on billing module tables (run after 008/009 if tables exist without policies).
-- Idempotent — safe to paste in Supabase SQL Editor and re-run.

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
