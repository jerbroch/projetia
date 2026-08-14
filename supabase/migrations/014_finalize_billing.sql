-- 014_finalize_billing.sql
-- Fusionne 012 (prix catalogue + marge matériaux + is_divers) et 013 (persistance + tarifs main-d'œuvre)
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase — ne pas exécuter 012 ou 013 séparément après 014
-- Idempotent — sans DROP TABLE, TRUNCATE ni DELETE de données métier

-- =============================================================================
-- 1. Prix catalogue par compagnie (reference_price + custom_price)
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

-- Colonnes manquantes si la table existait déjà (ex. 012 partiel)
ALTER TABLE company_catalog_prices
  ADD COLUMN IF NOT EXISTS reference_price NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS custom_price NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS price_source TEXT,
  ADD COLUMN IF NOT EXISTS manually_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_company_catalog_prices_company
  ON company_catalog_prices (company_id);

CREATE INDEX IF NOT EXISTS idx_company_catalog_prices_catalog
  ON company_catalog_prices (catalog_item_id);

DROP TRIGGER IF EXISTS company_catalog_prices_updated_at ON company_catalog_prices;
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
-- 2. Persistance facturation : marge matériaux globale + sous-total coût + Divers
-- =============================================================================
-- job_billing_lines : quantity (heures main-d'œuvre / qté matériaux), unit_cost, unit_sell_price
-- déjà créés dans 008 — 014 garantit les colonnes de persistance ajoutées en 012/013.

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

-- =============================================================================
-- 4. Index unique pour inserts idempotents des modèles main-d'œuvre
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_labor_rate_templates_company_name_type
  ON labor_rate_templates (company_id, name, rate_type);

-- =============================================================================
-- 5. Tarifs main-d'œuvre requis pour toutes les compagnies
--    Transport = 75 $/trajet, 1 compagnon = 125 $/h, 1 compagnon + 1 apprenti = 235 $/h
-- =============================================================================

-- Renommer l'ancien libellé vers Transport
UPDATE labor_rate_templates
SET name = 'Transport'
WHERE name = 'Temps déplacement'
  AND rate_type = 'regular';

UPDATE labor_rate_templates
SET
  bill_rate = 125.00,
  cost_per_hr = 125.00,
  margin_pct = NULL
WHERE name = '1 compagnon'
  AND rate_type = 'regular';

UPDATE labor_rate_templates
SET
  bill_rate = 235.00,
  cost_per_hr = 235.00,
  margin_pct = NULL
WHERE name = '1 compagnon + 1 apprenti'
  AND rate_type = 'regular';

UPDATE labor_rate_templates
SET
  bill_rate = 75.00,
  cost_per_hr = 75.00,
  margin_pct = NULL
WHERE name = 'Transport'
  AND rate_type = 'regular';

-- Insérer Transport pour les compagnies sans ce modèle
INSERT INTO labor_rate_templates (
  company_id, name, worker_count, cost_per_hr, bill_rate, margin_pct, rate_type, sort_order, is_active
)
SELECT
  c.id,
  'Transport',
  1,
  75.00,
  75.00,
  NULL,
  'regular',
  30,
  TRUE
FROM companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM labor_rate_templates l
  WHERE l.company_id = c.id
    AND l.name = 'Transport'
    AND l.rate_type = 'regular'
);

-- =============================================================================
-- 6. Fonction seed — nouvelles compagnies + rattrapage tarifs requis
-- =============================================================================

CREATE OR REPLACE FUNCTION _seed_labor_rate_templates(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO labor_rate_templates (
    company_id, name, worker_count, cost_per_hr, bill_rate, margin_pct, rate_type, sort_order, is_active
  ) VALUES
    (p_company_id, '1 compagnon', 1, 125.00, 125.00, NULL, 'regular', 1, TRUE),
    (p_company_id, '1 apprenti', 1, 0, 0, NULL, 'regular', 2, TRUE),
    (p_company_id, '1 compagnon + 1 apprenti', 2, 235.00, 235.00, NULL, 'regular', 3, TRUE),
    (p_company_id, '2 compagnons', 2, 0, 0, NULL, 'regular', 4, TRUE),
    (p_company_id, '2 apprentis', 2, 0, 0, NULL, 'regular', 5, TRUE),
    (p_company_id, '2 compagnons + 1 apprenti', 3, 0, 0, NULL, 'regular', 6, TRUE),
    (p_company_id, '1 compagnon + 2 apprentis', 3, 0, 0, NULL, 'regular', 7, TRUE),
    (p_company_id, '3 compagnons', 3, 0, 0, NULL, 'regular', 8, TRUE),
    (p_company_id, '3 compagnons + 1 apprenti', 4, 0, 0, NULL, 'regular', 9, TRUE),
    (p_company_id, '1 compagnon (temps et demi)', 1, 0, 0, NULL, 'overtime', 10, TRUE),
    (p_company_id, '1 apprenti (temps et demi)', 1, 0, 0, NULL, 'overtime', 11, TRUE),
    (p_company_id, '1 compagnon + 1 apprenti (temps et demi)', 2, 0, 0, NULL, 'overtime', 12, TRUE),
    (p_company_id, '2 compagnons (temps et demi)', 2, 0, 0, NULL, 'overtime', 13, TRUE),
    (p_company_id, '2 apprentis (temps et demi)', 2, 0, 0, NULL, 'overtime', 14, TRUE),
    (p_company_id, '2 compagnons + 1 apprenti (temps et demi)', 3, 0, 0, NULL, 'overtime', 15, TRUE),
    (p_company_id, '1 compagnon + 2 apprentis (temps et demi)', 3, 0, 0, NULL, 'overtime', 16, TRUE),
    (p_company_id, '3 compagnons (temps et demi)', 3, 0, 0, NULL, 'overtime', 17, TRUE),
    (p_company_id, '3 compagnons + 1 apprenti (temps et demi)', 4, 0, 0, NULL, 'overtime', 18, TRUE),
    (p_company_id, '1 compagnon (temps double)', 1, 0, 0, NULL, 'double_time', 19, TRUE),
    (p_company_id, '1 apprenti (temps double)', 1, 0, 0, NULL, 'double_time', 20, TRUE),
    (p_company_id, '1 compagnon + 1 apprenti (temps double)', 2, 0, 0, NULL, 'double_time', 21, TRUE),
    (p_company_id, '2 compagnons (temps double)', 2, 0, 0, NULL, 'double_time', 22, TRUE),
    (p_company_id, '2 apprentis (temps double)', 2, 0, 0, NULL, 'double_time', 23, TRUE),
    (p_company_id, '2 compagnons + 1 apprenti (temps double)', 3, 0, 0, NULL, 'double_time', 24, TRUE),
    (p_company_id, '1 compagnon + 2 apprentis (temps double)', 3, 0, 0, NULL, 'double_time', 25, TRUE),
    (p_company_id, '3 compagnons (temps double)', 3, 0, 0, NULL, 'double_time', 26, TRUE),
    (p_company_id, '3 compagnons + 1 apprenti (temps double)', 4, 0, 0, NULL, 'double_time', 27, TRUE),
    (p_company_id, 'Contremaître', 1, 0, 0, NULL, 'regular', 28, TRUE),
    (p_company_id, 'Technicien/service', 1, 0, 0, NULL, 'regular', 29, TRUE),
    (p_company_id, 'Transport', 1, 75.00, 75.00, NULL, 'regular', 30, TRUE)
  ON CONFLICT (company_id, name, rate_type) DO NOTHING;

  -- Garantir les tarifs requis même si les modèles existaient déjà à 0
  UPDATE labor_rate_templates
  SET bill_rate = 125.00, cost_per_hr = 125.00, margin_pct = NULL
  WHERE company_id = p_company_id AND name = '1 compagnon' AND rate_type = 'regular';

  UPDATE labor_rate_templates
  SET bill_rate = 235.00, cost_per_hr = 235.00, margin_pct = NULL
  WHERE company_id = p_company_id AND name = '1 compagnon + 1 apprenti' AND rate_type = 'regular';

  UPDATE labor_rate_templates
  SET name = 'Transport', bill_rate = 75.00, cost_per_hr = 75.00, margin_pct = NULL
  WHERE company_id = p_company_id AND name = 'Temps déplacement' AND rate_type = 'regular';

  UPDATE labor_rate_templates
  SET bill_rate = 75.00, cost_per_hr = 75.00, margin_pct = NULL
  WHERE company_id = p_company_id AND name = 'Transport' AND rate_type = 'regular';
END;
$$;
