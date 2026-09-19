-- ---------------------------------------------------------------------------
-- LA VUE DES NOMS NE SE LAISSE PLUS ÉCRIRE
--
-- La migration 050 a créé `employes_noms` avec `REVOKE ALL ... FROM PUBLIC`.
-- Cette révocation n'a rien révoqué : dans un projet Supabase, `anon` et
-- `authenticated` reçoivent des droits EXPLICITES par les privilèges par
-- défaut du schéma public. Retirer ceux du rôle PUBLIC ne les touche pas.
--
-- Or une vue simple sur une seule table est AUTO-MODIFIABLE en PostgreSQL, et
-- celle-ci s'exécute avec les droits de son propriétaire (`security_invoker`
-- désactivé, pour pouvoir lire `employees` malgré sa RLS). Les deux réunis
-- donnaient à tout employé le droit d'écrire dans `employees` en passant par
-- la vue — RLS contournée.
--
-- Éprouvé avec le vrai jeton d'un employé sur la base de développement :
-- modifier le nom d'un collègue, ACCEPTÉ ; le supprimer, ACCEPTÉ. La fiche
-- disparaissait pour de bon.
--
-- La lecture, elle, était bien cloisonnée : sans session, zéro ligne.
--
-- On retire donc les droits aux rôles qui les portent vraiment, et on ne rend
-- que `SELECT`. `security_barrier` s'ajoute au passage : sans lui, une
-- fonction peu coûteuse glissée dans un `WHERE` peut s'exécuter avant le
-- filtre de la vue et observer des lignes d'autres entreprises.
--
-- Idempotent — sans danger à rejouer.
-- ---------------------------------------------------------------------------

ALTER VIEW employes_noms SET (security_barrier = true);

REVOKE ALL ON employes_noms FROM PUBLIC;
REVOKE ALL ON employes_noms FROM anon;
REVOKE ALL ON employes_noms FROM authenticated;

GRANT SELECT ON employes_noms TO authenticated;

COMMENT ON VIEW employes_noms IS
  'Noms des collègues d''une même entreprise, sans taux horaire ni coordonnées. LECTURE SEULE : une vue auto-modifiable exécutée avec les droits du propriétaire contournerait la RLS de `employees`.';
