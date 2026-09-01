-- Huit gabarits de départ, avec un coût et un prix de vente DISTINCTS.
--
-- Le semis précédent créait 30 gabarits par entreprise, dont 27 à 0 $. Trois
-- seulement portaient un taux, et sur ces trois `cost_per_hr` était recopié
-- depuis `bill_rate` — la distinction coût/vente n'était donc jamais utilisée,
-- alors que c'est elle qui dit si un chantier a été payant.
--
-- Ces montants sont des EXEMPLES. Les 125 $/h du compagnon ne sont pas ceux du
-- voisin ; chaque entrepreneur ajuste les siens dans Paramètres. Ils existent
-- pour qu'une première soumission soit possible sans avoir à tout saisir
-- d'abord — un entrepreneur qui doit configurer une heure avant de produire
-- quoi que ce soit n'y revient pas.
--
-- Le coût suppose des charges (CNESST, vacances, avantages) d'environ 78 % du
-- salaire brut : un compagnon payé 35 $/h revient à ~62 $/h.
--
-- N'AFFECTE QUE LES NOUVELLES ENTREPRISES. Les taux déjà saisis par un
-- entrepreneur ne sont jamais écrasés : ON CONFLICT DO NOTHING, et les mises à
-- jour forcées de l'ancienne fonction sont retirées.

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
    (p_company_id, 'Compagnon',                          1,  62.00, 125.00, NULL, 'regular',  1, TRUE),
    (p_company_id, 'Apprenti',                           1,  42.00,  85.00, NULL, 'regular',  2, TRUE),
    (p_company_id, 'Compagnon + apprenti',               2, 104.00, 210.00, NULL, 'regular',  3, TRUE),
    (p_company_id, 'Chargé de projet',                   1,  78.00, 145.00, NULL, 'regular',  4, TRUE),
    (p_company_id, 'Transport',                          1,  38.00,  75.00, NULL, 'regular',  5, TRUE),
    (p_company_id, 'Compagnon — temps et demi',          1,  93.00, 187.50, NULL, 'overtime', 6, TRUE),
    (p_company_id, 'Apprenti — temps et demi',           1,  63.00, 127.50, NULL, 'overtime', 7, TRUE),
    (p_company_id, 'Urgence / soir et fin de semaine',   1,  93.00, 195.00, NULL, 'overtime', 8, TRUE)
  ON CONFLICT (company_id, name, rate_type) DO NOTHING;
END;
$$;

-- Les entreprises DÉJÀ inscrites reçoivent les huit gabarits manquants, sans
-- que rien de ce qu'elles ont saisi ne bouge. Celles qui ont déjà réglé leur
-- « 1 compagnon » à 125 $/h le gardent : le nouveau « Compagnon » arrive à
-- côté, et l'ancien reste tel quel jusqu'à ce qu'elles fassent le tri.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM companies LOOP
    PERFORM _seed_labor_rate_templates(c.id);
  END LOOP;
END;
$$;
