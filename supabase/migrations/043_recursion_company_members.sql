-- Récursion infinie dans les politiques de `company_members`.
--
-- SYMPTÔME : « infinite recursion detected in policy for relation
-- "company_members" » à l'enregistrement des coordonnées Interac.
--
-- CAUSE : la politique `company_members_manage` interrogeait
-- `company_members` DEPUIS UNE POLITIQUE POSÉE SUR `company_members`. Toute
-- lecture déclenche les politiques, qui relisent la table, qui déclenchent les
-- politiques. Postgres s'arrête au bout de quelques tours et lève l'erreur.
--
-- La migration 002 corrigeait déjà exactement ce défaut — son entête le dit
-- mot pour mot : « Fix infinite recursion in company_members RLS policies ».
-- Elle lisait `profiles`, une AUTRE table, ce qui rompt la boucle.
--
-- Mais la production ne portait pas cette version. Les deux politiques y
-- avaient été remplacées HORS MIGRATION, à la main. Le dev, lui, était resté
-- conforme au dépôt — c'est pourquoi le défaut ne s'y reproduisait pas.
--
-- MESURÉ sur le dev, en y installant temporairement la version de production :
--
--   lire company_members  (session.ts, middleware-access.ts)  → ÉCHEC
--   écrire companies      (Interac, entreprise, marge)         → ÉCHEC
--   lire customers        (tout le reste de l'application)     → ok
--
-- Le reste de l'application tenait parce que ses politiques passent par
-- `auth_user_company_ids()`, qui est SECURITY DEFINER : la RLS ne s'applique
-- pas à l'intérieur, donc rien ne boucle.

-- 1. LECTURE. On passe par la fonction SECURITY DEFINER : elle interroge bien
--    `company_members`, mais sans réévaluer les politiques.
DROP POLICY IF EXISTS company_members_select ON company_members;
CREATE POLICY company_members_select ON company_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (SELECT auth_user_company_ids())
  );

-- 2. ÉCRITURE. On lit `profiles`, jamais `company_members` : c'est la règle qui
--    empêche la boucle, et c'est celle que la migration 002 avait posée.
--
--    NE PAS « SIMPLIFIER » EN LISANT company_members ICI. C'est précisément le
--    changement qui a produit cette panne, et il ne se voit pas à l'écriture :
--    la requête est correcte, c'est son évaluation qui boucle.
DROP POLICY IF EXISTS company_members_manage ON company_members;
CREATE POLICY company_members_manage ON company_members
  FOR ALL USING (
    company_id IN (
      SELECT p.company_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  );
