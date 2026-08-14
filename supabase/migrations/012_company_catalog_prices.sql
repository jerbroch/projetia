-- 012_company_catalog_prices.sql
-- Prix catalogue par compagnie : reference_price (import) + custom_price (override admin)
-- Marge matériaux globale par feuille de facturation (plus de marge par ligne)
-- Idempotent — sans DROP TABLE, TRUNCATE ni DELETE

-- =============================================================================
-- 1. Prix catalogue par compagnie (reference + custom)
-- =============================================================================
-- CSV import format (header row required):
--   sku,name,diameter,reference_price,source_url
--   ,Coude 90° cuivre,3/4",12.50,https://example.com/product/123
-- Match catalog items by name + diameter (sku optional). custom_price is NEVER
-- overwritten by import when manually_overridden = TRUE.

CREATE TABLE IF NOT EXISTS company_catalog_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES material_catalog_items (id) ON DELETE CASCADE,
  reference_price NUMERIC(12, 4),
  custom_price NUMERIC(12, 4),
  price_source TEXT,
  manually_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_company_catalog_prices_company
  ON company_catalog_prices (company_id);

CREATE INDEX IF NOT EXISTS idx_company_catalog_prices_catalog
  ON company_catalog_prices (catalog_item_id);

CREATE TRIGGER company_catalog_prices_updated_at
  BEFORE UPDATE ON company_catalog_prices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE company_catalog_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_catalog_prices_company_isolation ON company_catalog_prices;
CREATE POLICY company_catalog_prices_company_isolation ON company_catalog_prices
  FOR ALL TO authenticated
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- =============================================================================
-- 2. Marge matériaux globale par feuille + sous-total coût
-- =============================================================================

ALTER TABLE job_billing_sheets
  ADD COLUMN IF NOT EXISTS material_margin_pct NUMERIC(5, 4),
  ADD COLUMN IF NOT EXISTS material_cost_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE job_billing_lines
  ADD COLUMN IF NOT EXISTS is_divers BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- 3. Fonction utilitaire : prix effectif (custom > reference)
-- =============================================================================

CREATE OR REPLACE FUNCTION effective_catalog_price(
  p_custom_price NUMERIC,
  p_reference_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_custom_price, p_reference_price, 0);
$$;
