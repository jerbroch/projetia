-- Retire de la liste les gabarits de main-d'œuvre qui n'ont jamais eu de taux.
--
-- Un jeu de 30 gabarits est semé à la création d'une entreprise : toutes les
-- combinaisons mécaniques de compagnons et d'apprentis. Dans les faits, trois
-- seulement sont remplis — « 1 compagnon », « 1 compagnon + 1 apprenti » et
-- « Transport ». Les 27 autres restent à 0 $ et polluent chaque sélecteur :
-- le choix de gabarit ligne par ligne en propose 30, dont 27 factureraient
-- zéro sans rien dire.
--
-- DÉSACTIVÉS, PAS SUPPRIMÉS. Une ligne de facturation en production référence
-- déjà « 3 compagnons » — supprimer la rangée casserait ce lien, ou le
-- viderait selon la contrainte. `is_active = false` les retire des listes tout
-- en gardant l'historique lisible. Et l'employeur peut en réactiver un en
-- posant simplement son taux.
--
-- Ne touche QUE ceux dont le coût ET le prix de vente sont nuls : un gabarit
-- à 0 $ de coût mais 125 $ de vente est un choix, pas un oubli.
UPDATE labor_rate_templates
SET is_active = false,
    updated_at = now()
WHERE is_active = true
  AND COALESCE(cost_per_hr, 0) = 0
  AND COALESCE(bill_rate, 0) = 0;
