-- Les gabarits de départ deviennent génériques, sans taux.
--
-- La migration 038 semait huit gabarits nommés — « Compagnon » à 125 $/h,
-- « Apprenti » à 85 $/h — c'est-à-dire le vocabulaire et les tarifs d'un
-- plombier. Pour un couvreur, un paysagiste ou un excavateur, ces mots ne
-- veulent rien dire et ces montants sont faux.
--
-- Pire : un taux plausible mais faux est plus dangereux qu'un champ vide. Il
-- peut partir sur une soumission sans que personne s'en aperçoive, alors qu'un
-- champ vide se voit. C'est pourquoi les quatre gabarits arrivent à zéro.
--
-- LE MÊME VOCABULAIRE QUE LES RÔLES. « Employé senior », « Employé » et
-- « Apprenti » sont exactement les trois rôles semés par la migration 039 :
-- l'entrepreneur renomme les uns et les autres avec ses propres mots, et les
-- deux écrans se répondent au lieu de parler deux langues.
--
-- « Transport » reste : tous les métiers se déplacent. Aucune combinaison
-- d'équipe ni aucun temps supplémentaire n'est présumé — l'entrepreneur ajoute
-- « 2 couvreurs » ou « Soir et fin de semaine » s'il en a besoin.
--
-- POURQUOI ZÉRO ET NON NULL. `cost_per_hr` et `bill_rate` sont NOT NULL depuis
-- l'origine, avec 0 par défaut, et l'application fait de l'arithmétique dessus
-- partout. Les rendre nullables pour distinguer « vide » de « zéro » aurait
-- touché tout le calcul de facturation pour un gain marginal : le code traite
-- déjà `bill_rate <= 0` comme « prix à saisir ». C'est cette convention qui
-- porte l'avertissement, pas une nouvelle colonne.
--
-- N'AFFECTE QUE LES NOUVELLES ENTREPRISES. Les gabarits déjà remplis
-- appartiennent à leur propriétaire : rien n'est réécrit, rien n'est effacé.
CREATE OR REPLACE FUNCTION _seed_labor_rate_templates(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Une seule fois : `seed_company_billing_defaults` est appelée à chaque
  -- chargement des paramètres de facturation, pas seulement à l'inscription.
  -- Sans cette garde, un gabarit renommé ou retiré reviendrait tout seul.
  IF EXISTS (SELECT 1 FROM labor_rate_templates WHERE company_id = p_company_id) THEN
    RETURN;
  END IF;

  INSERT INTO labor_rate_templates (
    company_id, name, worker_count, cost_per_hr, bill_rate, margin_pct, rate_type, sort_order, is_active
  ) VALUES
    (p_company_id, 'Employé senior', 1, 0, 0, NULL, 'regular', 1, TRUE),
    (p_company_id, 'Employé',        1, 0, 0, NULL, 'regular', 2, TRUE),
    (p_company_id, 'Apprenti',       1, 0, 0, NULL, 'regular', 3, TRUE),
    (p_company_id, 'Transport',      1, 0, 0, NULL, 'regular', 4, TRUE);
END;
$$;
