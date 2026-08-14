-- Billing seed: expanded material catalog + default labor rate templates per company

-- Idempotent unique keys for global catalog and company labor templates
CREATE UNIQUE INDEX IF NOT EXISTS idx_material_catalog_global_unique
  ON material_catalog_items (category_id, name, COALESCE(diameter, ''), COALESCE(fitting_type, ''))
  WHERE company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_labor_rate_templates_company_name_type
  ON labor_rate_templates (company_id, name, rate_type);

-- Internal: seed labor rate templates (no auth — used by migration + public RPC)
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
    -- Crew compositions — regular
    (p_company_id, '1 compagnon', 1, 0, 0, NULL, 'regular', 1, TRUE),
    (p_company_id, '1 apprenti', 1, 0, 0, NULL, 'regular', 2, TRUE),
    (p_company_id, '1 compagnon + 1 apprenti', 2, 0, 0, NULL, 'regular', 3, TRUE),
    (p_company_id, '2 compagnons', 2, 0, 0, NULL, 'regular', 4, TRUE),
    (p_company_id, '2 apprentis', 2, 0, 0, NULL, 'regular', 5, TRUE),
    (p_company_id, '2 compagnons + 1 apprenti', 3, 0, 0, NULL, 'regular', 6, TRUE),
    (p_company_id, '1 compagnon + 2 apprentis', 3, 0, 0, NULL, 'regular', 7, TRUE),
    (p_company_id, '3 compagnons', 3, 0, 0, NULL, 'regular', 8, TRUE),
    (p_company_id, '3 compagnons + 1 apprenti', 4, 0, 0, NULL, 'regular', 9, TRUE),
    -- Crew compositions — overtime
    (p_company_id, '1 compagnon (temps et demi)', 1, 0, 0, NULL, 'overtime', 10, TRUE),
    (p_company_id, '1 apprenti (temps et demi)', 1, 0, 0, NULL, 'overtime', 11, TRUE),
    (p_company_id, '1 compagnon + 1 apprenti (temps et demi)', 2, 0, 0, NULL, 'overtime', 12, TRUE),
    (p_company_id, '2 compagnons (temps et demi)', 2, 0, 0, NULL, 'overtime', 13, TRUE),
    (p_company_id, '2 apprentis (temps et demi)', 2, 0, 0, NULL, 'overtime', 14, TRUE),
    (p_company_id, '2 compagnons + 1 apprenti (temps et demi)', 3, 0, 0, NULL, 'overtime', 15, TRUE),
    (p_company_id, '1 compagnon + 2 apprentis (temps et demi)', 3, 0, 0, NULL, 'overtime', 16, TRUE),
    (p_company_id, '3 compagnons (temps et demi)', 3, 0, 0, NULL, 'overtime', 17, TRUE),
    (p_company_id, '3 compagnons + 1 apprenti (temps et demi)', 4, 0, 0, NULL, 'overtime', 18, TRUE),
    -- Crew compositions — double time
    (p_company_id, '1 compagnon (temps double)', 1, 0, 0, NULL, 'double_time', 19, TRUE),
    (p_company_id, '1 apprenti (temps double)', 1, 0, 0, NULL, 'double_time', 20, TRUE),
    (p_company_id, '1 compagnon + 1 apprenti (temps double)', 2, 0, 0, NULL, 'double_time', 21, TRUE),
    (p_company_id, '2 compagnons (temps double)', 2, 0, 0, NULL, 'double_time', 22, TRUE),
    (p_company_id, '2 apprentis (temps double)', 2, 0, 0, NULL, 'double_time', 23, TRUE),
    (p_company_id, '2 compagnons + 1 apprenti (temps double)', 3, 0, 0, NULL, 'double_time', 24, TRUE),
    (p_company_id, '1 compagnon + 2 apprentis (temps double)', 3, 0, 0, NULL, 'double_time', 25, TRUE),
    (p_company_id, '3 compagnons (temps double)', 3, 0, 0, NULL, 'double_time', 26, TRUE),
    (p_company_id, '3 compagnons + 1 apprenti (temps double)', 4, 0, 0, NULL, 'double_time', 27, TRUE),
    -- Special roles
    (p_company_id, 'Contremaître', 1, 0, 0, NULL, 'regular', 28, TRUE),
    (p_company_id, 'Technicien/service', 1, 0, 0, NULL, 'regular', 29, TRUE),
    (p_company_id, 'Temps déplacement', 1, 0, 0, NULL, 'regular', 30, TRUE)
  ON CONFLICT (company_id, name, rate_type) DO NOTHING;
END;
$$;

-- Public RPC: suppliers + labor templates for a company
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

  PERFORM _seed_labor_rate_templates(p_company_id);
END;
$$;

-- Seed global material catalog (generic plumbing — no supplier prices)
WITH diameters AS (
  SELECT unnest(ARRAY[
    '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '3-1/2"', '4"'
  ]) AS d
),
diameters_small AS (
  SELECT unnest(ARRAY['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"']) AS d
),
product_defs AS (
  SELECT * FROM (VALUES
    ('tuyau-cuivre', 'Tuyau cuivre type L', NULL::TEXT, 'pi'),
    ('tuyau-cuivre', 'Tuyau cuivre type M', NULL, 'pi'),
    ('fittings-cuivre', 'Coude 90° cuivre', 'coude 90', 'unité'),
    ('fittings-cuivre', 'Coude 45° cuivre', 'coude 45', 'unité'),
    ('fittings-cuivre', 'Té cuivre', 'tee', 'unité'),
    ('fittings-cuivre', 'Union cuivre', 'union', 'unité'),
    ('fittings-cuivre', 'Coude 90° rue cuivre', 'coude 90 rue', 'unité'),
    ('fittings-cuivre', 'Manchon cuivre', 'manchon', 'unité'),
    ('pvc-dwv', 'Tuyau PVC DWV', NULL, 'pi'),
    ('pvc-dwv', 'Coude 90° PVC DWV', 'coude 90', 'unité'),
    ('pvc-dwv', 'Coude 45° PVC DWV', 'coude 45', 'unité'),
    ('pvc-dwv', 'Té PVC DWV', 'tee', 'unité'),
    ('pvc-dwv', 'Y PVC DWV', 'y', 'unité'),
    ('pvc-dwv', 'P-trap PVC DWV', 'p-trap', 'unité'),
    ('pvc-pression', 'Tuyau PVC pression', NULL, 'pi'),
    ('pvc-pression', 'Coude 90° PVC pression', 'coude 90', 'unité'),
    ('pvc-pression', 'Té PVC pression', 'tee', 'unité'),
    ('cpvc', 'Tuyau CPVC', NULL, 'pi'),
    ('cpvc', 'Coude 90° CPVC', 'coude 90', 'unité'),
    ('cpvc', 'Té CPVC', 'tee', 'unité'),
    ('abs', 'Tuyau ABS', NULL, 'pi'),
    ('abs', 'Coude 90° ABS', 'coude 90', 'unité'),
    ('abs', 'Coude 45° ABS', 'coude 45', 'unité'),
    ('abs', 'Té ABS', 'tee', 'unité'),
    ('fonte', 'Tuyau fonte', NULL, 'pi'),
    ('fonte', 'Coude 90° fonte', 'coude 90', 'unité'),
    ('fonte', 'Té fonte', 'tee', 'unité'),
    ('acier-noir', 'Tuyau acier noir', NULL, 'pi'),
    ('acier-noir', 'Coude 90° acier noir', 'coude 90', 'unité'),
    ('acier-noir', 'Té acier noir', 'tee', 'unité'),
    ('acier-galvanise', 'Tuyau acier galvanisé', NULL, 'pi'),
    ('acier-galvanise', 'Coude 90° acier galvanisé', 'coude 90', 'unité'),
    ('acier-galvanise', 'Té acier galvanisé', 'tee', 'unité'),
    ('stainless', 'Tuyau acier inox', NULL, 'pi'),
    ('stainless', 'Coude 90° acier inox', 'coude 90', 'unité'),
    ('pex', 'Tuyau PEX-A', NULL, 'pi'),
    ('pex', 'Tuyau PEX-B', NULL, 'pi'),
    ('pex', 'Coude PEX', 'coude 90', 'unité'),
    ('pex', 'Té PEX', 'tee', 'unité'),
    ('propress', 'Tuyau ProPress', NULL, 'pi'),
    ('propress', 'Coude 90° ProPress', 'coude 90', 'unité'),
    ('propress', 'Té ProPress', 'tee', 'unité'),
    ('propress', 'Manchon ProPress', 'manchon', 'unité'),
    ('megapress', 'Tuyau MegaPress', NULL, 'pi'),
    ('megapress', 'Coude 90° MegaPress', 'coude 90', 'unité'),
    ('megapress', 'Té MegaPress', 'tee', 'unité'),
    ('megapress', 'Manchon MegaPress', 'manchon', 'unité'),
    ('fittings-filetes', 'Mamelon fileté', 'mamelon', 'unité'),
    ('fittings-filetes', 'Coude 90° fileté', 'coude 90', 'unité'),
    ('fittings-filetes', 'Té fileté', 'tee', 'unité'),
    ('fittings-filetes', 'Bouchon fileté', 'bouchon', 'unité'),
    ('fittings-mecaniques', 'Raccord mécanique', 'raccord', 'unité'),
    ('fittings-mecaniques', 'Manchon mécanique', 'manchon', 'unité'),
    ('victaulic', 'Coude Victaulic', 'coude 90', 'unité'),
    ('victaulic', 'Té Victaulic', 'tee', 'unité'),
    ('valves', 'Vanne à boisseau', 'vanne boisseau', 'unité'),
    ('valves', 'Vanne papillon', 'vanne papillon', 'unité'),
    ('valves', 'Clapet anti-retour', 'clapet', 'unité'),
    ('valves', 'Robinet-équerre', 'robinet', 'unité'),
    ('supports', 'Support tuyau', 'support', 'unité'),
    ('supports', 'Collerette', 'collerette', 'unité'),
    ('supports', 'Étrier', 'etrier', 'unité'),
    ('isolants', 'Isolant tuyau', NULL, 'pi'),
    ('isolants', 'Manchon isolant', 'manchon', 'unité')
  ) AS t(slug, name, fitting_type, unit)
),
product_defs_small AS (
  SELECT * FROM (VALUES
    ('clapets', 'Clapet anti-retour', 'clapet', 'unité'),
    ('regulateurs', 'Régulateur de pression', 'regulateur', 'unité'),
    ('drains', 'Drain plancher', 'drain', 'unité'),
    ('drains', 'Drain garage', 'drain', 'unité'),
    ('gaz-naturel', 'Tuyau gaz CSST', NULL, 'pi'),
    ('gaz-naturel', 'Raccord gaz', 'raccord', 'unité')
  ) AS t(slug, name, fitting_type, unit)
),
fixed_items AS (
  SELECT * FROM (VALUES
    ('pompes', 'Pompe de puisard', NULL::TEXT, NULL::TEXT, 'unité'),
    ('pompes', 'Pompe eau chaude', NULL, NULL, 'unité'),
    ('chauffe-eau', 'Chauffe-eau 40 gal', NULL, NULL, 'unité'),
    ('chauffe-eau', 'Chauffe-eau 60 gal', NULL, NULL, 'unité'),
    ('chauffe-eau', 'Chauffe-eau 80 gal', NULL, NULL, 'unité'),
    ('chaudieres', 'Chaudière murale', NULL, NULL, 'unité'),
    ('chaudieres', 'Chaudière plancher', NULL, NULL, 'unité'),
    ('robinets', 'Robinet d''arrêt', '3/8"', NULL, 'unité'),
    ('robinets', 'Robinet d''arrêt', '1/2"', NULL, 'unité'),
    ('robinets', 'Robinet cuisine', NULL, NULL, 'unité'),
    ('robinets', 'Robinet salle de bain', NULL, NULL, 'unité'),
    ('robinets', 'Robinet buanderie', NULL, NULL, 'unité'),
    ('toilettes', 'Toilette standard', NULL, NULL, 'unité'),
    ('toilettes', 'Toilette elongated', NULL, NULL, 'unité'),
    ('toilettes', 'Toilette suspendue', NULL, NULL, 'unité'),
    ('lavabos', 'Lavabo pédestal', NULL, NULL, 'unité'),
    ('lavabos', 'Lavabo vanité', NULL, NULL, 'unité'),
    ('lavabos', 'Lavabo mural', NULL, NULL, 'unité'),
    ('douches', 'Base douche', NULL, NULL, 'unité'),
    ('douches', 'Douche sans seuil', NULL, NULL, 'unité'),
    ('douches', 'Colonne douche', NULL, NULL, 'unité'),
    ('accessoires', 'Ruban téflon', NULL, NULL, 'unité'),
    ('accessoires', 'Pâte à joint', NULL, NULL, 'unité'),
    ('accessoires', 'Nettoyant tuyau', NULL, NULL, 'unité'),
    ('accessoires', 'Flux soudure', NULL, NULL, 'unité'),
    ('accessoires', 'Fil d''étanchéité', NULL, NULL, 'unité'),
    ('accessoires', 'Cadenas vanne', NULL, NULL, 'unité'),
    ('accessoires', 'Étiquette tuyau', NULL, NULL, 'unité'),
    ('accessoires', 'Mastic silicone', NULL, NULL, 'unité'),
    ('accessoires', 'Mousse isolante', NULL, NULL, 'unité'),
    ('accessoires', 'Boulons support', NULL, NULL, 'unité'),
    ('divers', 'Bac rétention', NULL, NULL, 'unité'),
    ('divers', 'Flexible décharge', NULL, NULL, 'unité'),
    ('divers', 'Flexible alimentation', NULL, NULL, 'unité'),
    ('divers', 'Siphon', NULL, NULL, 'unité'),
    ('divers', 'Bonde', NULL, NULL, 'unité')
  ) AS t(slug, name, diameter, fitting_type, unit)
),
puisard_items AS (
  SELECT 'puisards' AS slug, 'Puisard' AS name, d.d AS diameter, 'puisard'::TEXT AS fitting_type, 'unité' AS unit
  FROM unnest(ARRAY['2"', '3"', '4"']) AS d(d)
),
generated_full AS (
  SELECT p.slug, p.name, d.d AS diameter, p.fitting_type, p.unit
  FROM product_defs p
  CROSS JOIN diameters d
),
generated_small AS (
  SELECT p.slug, p.name, d.d AS diameter, p.fitting_type, p.unit
  FROM product_defs_small p
  CROSS JOIN diameters_small d
),
all_catalog AS (
  SELECT slug, name, diameter, fitting_type, unit FROM generated_full
  UNION ALL
  SELECT slug, name, diameter, fitting_type, unit FROM generated_small
  UNION ALL
  SELECT slug, name, diameter, fitting_type, unit FROM fixed_items
  UNION ALL
  SELECT slug, name, diameter, fitting_type, unit FROM puisard_items
)
INSERT INTO material_catalog_items (company_id, category_id, name, diameter, fitting_type, unit)
SELECT NULL, c.id, a.name, a.diameter, a.fitting_type, a.unit
FROM all_catalog a
JOIN material_categories c ON c.slug = a.slug AND c.company_id IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM material_catalog_items m
  WHERE m.company_id IS NULL
    AND m.category_id = c.id
    AND m.name = a.name
    AND COALESCE(m.diameter, '') = COALESCE(a.diameter, '')
    AND COALESCE(m.fitting_type, '') = COALESCE(a.fitting_type, '')
);

-- Backfill labor templates for existing companies
DO $$
DECLARE
  cid UUID;
BEGIN
  FOR cid IN SELECT id FROM companies LOOP
    PERFORM _seed_labor_rate_templates(cid);
  END LOOP;
END $$;
