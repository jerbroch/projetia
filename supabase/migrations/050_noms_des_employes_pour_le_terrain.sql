-- ---------------------------------------------------------------------------
-- LE TERRAIN PEUT LIRE LES NOMS DE SES COLLÈGUES — ET RIEN D'AUTRE
--
-- L'écran d'outillage doit dire « Détenue par : Alexandre Tremblay ». Il
-- affichait « Détenue par : ? », parce qu'un employé ne peut pas lire la
-- table `employees` : la migration 033 l'a fermée au terrain, et pour une
-- bonne raison — elle porte le TAUX HORAIRE de tout le monde.
--
-- On ne rouvre donc pas la table. On expose une vue qui ne contient que ce
-- qu'il faut pour nommer quelqu'un : identifiant, entreprise, prénom, nom.
-- Le salaire d'un collègue ne devient pas lisible parce qu'on veut savoir qui
-- a la perceuse.
--
-- LA VUE FILTRE ELLE-MÊME PAR ENTREPRISE. Une vue ne porte pas de politique
-- RLS ; sans cette clause, elle donnerait les noms de tous les clients de la
-- plateforme à n'importe quel utilisateur connecté.
--
-- Idempotent — sans danger à rejouer.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS employes_noms;

CREATE VIEW employes_noms
WITH (security_invoker = off) AS
  SELECT
    e.id,
    e.company_id,
    e.first_name,
    e.last_name,
    e.status
  FROM employees e
  WHERE e.company_id IN (SELECT auth_user_company_ids());

COMMENT ON VIEW employes_noms IS
  'Noms des collègues d''une même entreprise, sans taux horaire ni coordonnées. Sert à nommer le détenteur d''un outil côté terrain, là où `employees` reste fermée.';

REVOKE ALL ON employes_noms FROM PUBLIC;
GRANT SELECT ON employes_noms TO authenticated;
