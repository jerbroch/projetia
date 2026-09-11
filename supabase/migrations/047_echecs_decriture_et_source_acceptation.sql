-- =====================================================================
-- ConstructionOS — Migration 047
-- 1. Généraliser le compteur d'échecs d'écriture
-- 2. Savoir QUI a accepté une soumission
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. UN SEUL COMPTEUR D'ÉCHECS, POUR TOUS LES DOMAINES
--
-- `versioning_write_failures` a été créée pour le versionnage (migration
-- 046) : une écriture non bloquante qui rate ne doit pas vivre seulement
-- dans les logs du serveur, parce que personne ne les lit.
--
-- Le même besoin revient pour les dépôts : quand l'acceptation d'une
-- soumission réussit et que l'écriture du paiement échoue, l'entrepreneur
-- doit pouvoir consulter la liste des dépôts acceptés dont le paiement
-- n'est pas enregistré.
--
-- Deux tables presque identiques voudraient dire deux endroits à
-- consulter et deux jeux de politiques à tenir à jour. On généralise
-- celle qui existe plutôt que d'en ajouter une.
-- ---------------------------------------------------------------------

alter table versioning_write_failures rename to write_failures;

-- La valeur par défaut sert uniquement à remplir l'existant ; on la
-- retire aussitôt pour que chaque appelant dise de quel domaine il parle.
alter table write_failures
  add column if not exists domain text not null default 'versioning';
alter table write_failures
  alter column domain drop default;

alter table write_failures
  drop constraint if exists write_failures_domain_check;
alter table write_failures
  add constraint write_failures_domain_check
  check (domain in ('versioning', 'deposit'));

alter index if exists idx_vwf_company rename to idx_write_failures_company;
create index if not exists idx_write_failures_domain
  on write_failures(domain, created_at desc);

-- Les politiques suivent la table ; on les renomme pour qu'elles disent
-- encore ce qu'elles gardent.
alter policy vwf_office_write on write_failures rename to write_failures_office_write;
alter policy vwf_office_read on write_failures rename to write_failures_office_read;
alter policy vwf_super_admin_select on write_failures rename to write_failures_super_admin_select;


-- ---------------------------------------------------------------------
-- 2. QUI A ACCEPTÉ LA SOUMISSION
--
-- Un virement reçu EST une acceptation : c'est le geste le plus engageant
-- du client. Enregistrer un dépôt fait donc passer la soumission par
-- l'acceptation avant d'enregistrer le paiement — une seule action côté
-- utilisateur, deux transitions côté système.
--
-- Encore faut-il pouvoir les distinguer après coup. Jusqu'ici seule
-- `accepted_at` existait, et elle ne dit pas laquelle des deux s'est
-- produite.
--
-- Les quatre valeurs sont posées maintenant, y compris les deux qui ne
-- servent pas encore : élargir une contrainte plus tard sur une table de
-- production est une migration de plus pour rien.
--   client           le client a cliqué sur la page publique
--   depot_enregistre l'entrepreneur a enregistré le dépôt reçu
--   verbal           accord donné de vive voix (à venir)
--   papier           soumission signée sur papier (à venir)
-- ---------------------------------------------------------------------

alter table quotes
  add column if not exists accepted_source text;

alter table quotes
  drop constraint if exists quotes_accepted_source_check;
alter table quotes
  add constraint quotes_accepted_source_check
  check (accepted_source is null
         or accepted_source in ('client', 'depot_enregistre', 'verbal', 'papier'));

-- Nulle tant que rien n'est accepté. On ne remplit PAS l'historique : les
-- soumissions déjà acceptées l'ont été avant que la distinction existe,
-- et leur attribuer une origine serait inventer une information.
comment on column quotes.accepted_source is
  'Origine de l''acceptation. Nulle pour les soumissions acceptées avant la migration 047 — on ne devine pas après coup.';


commit;
