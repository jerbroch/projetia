-- =============================================================================
-- Fermer réellement la porte quand un accès est retiré.
--
-- Constat : revokeEmployeeAccessAction posait bien ses drapeaux
-- (profiles.status = 'inactive', app_access_enabled = false), mais RIEN ne les
-- lisait. La fonction qui décide de l'appartenance à une entreprise ignorait
-- le statut, si bien qu'un employé révoqué gardait l'accès complet aux données
-- de l'entreprise — pas seulement dans l'application, mais par l'API directe.
--
-- Idempotent : CREATE OR REPLACE et DROP POLICY IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. L'appartenance exige désormais un profil ACTIF.
--
-- Deux branches, deux précautions différentes :
--
--   • profiles : filtre direct sur status = 'active'.
--
--   • company_members : cette table n'a pas de statut. Un employé révoqué y
--     garde sa ligne, ce qui lui rendait l'entreprise par cette porte-là. On
--     l'exclut donc quand son profil existe ET n'est pas actif. Formulé en
--     NOT EXISTS plutôt qu'en jointure : un utilisateur SANS profil conserve
--     exactement le comportement d'avant, au lieu d'être coupé par effet de
--     bord. (Vérifié avant écriture : zéro membre sans profil en production.)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id
    FROM company_members
   WHERE user_id = auth.uid()
     AND NOT EXISTS (
       SELECT 1
         FROM profiles p
        WHERE p.id = auth.uid()
          AND p.status <> 'active'
     )
  UNION
  SELECT company_id
    FROM profiles
   WHERE id = auth.uid()
     AND status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 2. Laisser chacun lire SA PROPRE ligne de profil.
--
-- Sans cette politique, la restriction ci-dessus rendrait un employé révoqué
-- invisible à lui-même : profiles_select passe par auth_user_company_ids(), et
-- l'application ne pourrait plus lire son statut. Le middleware serait aveugle
-- et ne pourrait pas lui expliquer ce qui se passe — il verrait « aucun
-- profil », c'est-à-dire la même chose qu'un nouvel inscrit.
--
-- L'ouverture est nulle : chacun pouvait déjà lire sa propre ligne. Les
-- politiques permissives s'additionnent (OU), donc un employé révoqué voit
-- désormais SA ligne et rien d'autre.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_self ON profiles;
CREATE POLICY profiles_select_self ON profiles
  FOR SELECT
  USING (id = auth.uid());
