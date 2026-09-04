-- Ce que l'employé peut voir : les PRIX DE VENTE, jamais les coûts.
--
-- POURQUOI UNE VUE ET PAS UNE POLITIQUE RLS.
--
-- La RLS de PostgreSQL est une sécurité de RANGÉE. Elle décide quelles lignes
-- un compte voit ; elle ne peut pas masquer une colonne. Autoriser l'employé à
-- lire `labor_rate_templates` lui donnerait TOUTES les colonnes de ces lignes,
-- dont `cost_per_hr` — quoi que demande l'écran. L'application n'aurait qu'à ne
-- pas l'afficher ; l'API, elle, le rendrait à qui le demande, et les outils de
-- développement d'un téléphone suffisent à le demander.
--
-- Une vue qui n'expose pas la colonne règle la question à la source : la donnée
-- ne sort pas. C'est la différence entre « l'écran ne le montre pas » et « on ne
-- peut pas l'obtenir ».
--
-- Ces vues appartiennent au propriétaire de la base et NE PORTENT PAS
-- `security_invoker` : elles contournent volontairement la RLS des tables
-- sous-jacentes, que l'employé n'a pas le droit de lire. Le cloisonnement par
-- entreprise est donc refait ICI, explicitement, par `auth_user_company_ids()`.

-- ── Taux de main-d'œuvre, sans le coût ──────────────────────────────────────
DROP VIEW IF EXISTS field_labor_rates;
CREATE VIEW field_labor_rates AS
  SELECT
    t.id,
    t.company_id,
    t.name,
    t.worker_count,
    t.rate_type,
    t.bill_rate,     -- prix de vente : ce que l'employé peut annoncer au client
    t.sort_order
    -- cost_per_hr est VOLONTAIREMENT absent. Ne pas l'ajouter « pour plus tard ».
  FROM labor_rate_templates t
  WHERE t.is_active IS DISTINCT FROM FALSE
    AND t.company_id IN (SELECT auth_user_company_ids());

-- ── Matériaux, avec le prix de vente calculé ────────────────────────────────
--
-- ATTENTION : `reference_price` et `custom_price` sont des COÛTS. Le prix de
-- vente s'en déduit par la marge de l'entreprise — voir
-- `calculateSellPriceFromCost`. Exposer le prix du catalogue tel quel
-- montrerait donc la base de calcul de la marge. La vue ne rend que le
-- RÉSULTAT.
DROP VIEW IF EXISTS field_material_prices;
CREATE VIEW field_material_prices AS
  SELECT
    i.id,
    i.company_id,
    i.name,
    i.unit,
    i.category_id,
    i.search_text,
    CASE
      WHEN COALESCE(NULLIF(p.custom_price, 0), NULLIF(p.reference_price, 0)) IS NULL THEN NULL
      ELSE ROUND(
        COALESCE(NULLIF(p.custom_price, 0), NULLIF(p.reference_price, 0))
          * (1 + COALESCE(c.default_material_margin, 0)),
        2
      )
    END AS sell_price
  FROM material_catalog_items i
  JOIN companies c ON c.id = i.company_id
  LEFT JOIN company_catalog_prices p
    ON p.catalog_item_id = i.id AND p.company_id = i.company_id
  WHERE i.company_id IN (SELECT auth_user_company_ids());

-- Lisibles par un compte connecté, jamais par un visiteur anonyme.
REVOKE ALL ON field_labor_rates FROM anon;
REVOKE ALL ON field_material_prices FROM anon;
GRANT SELECT ON field_labor_rates TO authenticated;
GRANT SELECT ON field_material_prices TO authenticated;

-- ── Matériau signalé par l'employé ──────────────────────────────────────────
--
-- Un matériau absent du catalogue est posé quand même : le gars ne va pas
-- laisser un client sans valve parce que la pièce manque dans une liste. Il le
-- signale, la ligne entre sur la feuille de facturation SANS PRIX, et
-- l'entrepreneur la chiffre. Un matériau posé et non facturé est une perte
-- sèche ; une ligne à zéro qui saute aux yeux ne l'est pas.
ALTER TABLE job_billing_lines
  ADD COLUMN IF NOT EXISTS signale_par_employe BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN job_billing_lines.signale_par_employe IS
  'Ligne créée depuis le terrain pour un matériau absent du catalogue. À chiffrer par le bureau.';

CREATE INDEX IF NOT EXISTS job_billing_lines_signalees
  ON job_billing_lines (billing_sheet_id) WHERE signale_par_employe;
