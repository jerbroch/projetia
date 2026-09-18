-- ---------------------------------------------------------------------------
-- UNE PRISE NE TRAVERSE PAS LES ENTREPRISES
--
-- La migration 048 vérifiait deux choses à l'insertion — l'entreprise déclarée
-- et l'employé — mais PAS l'outil. Éprouvé sur la base de développement avec
-- un vrai jeton d'employé : un homme de l'entreprise A pouvait créer une prise
-- déclarée chez A tout en pointant sur un outil de l'entreprise B.
--
-- Il ne voyait pas cet outil, ne pouvait pas le lire, et son employeur ne
-- voyait rien non plus. Mais l'index unique de 048 porte sur `tool_id` SANS
-- égard à l'entreprise : la ligne fantôme verrouillait l'outil de B. Ses
-- propres employés recevaient alors un refus d'unicité sur un outil qui leur
-- paraissait disponible — une panne invisible, chez un client qui n'a rien
-- fait, causée par un autre client.
--
-- LA RÈGLE EST D'INTÉGRITÉ, PAS DE PERMISSION. On ne la met donc pas dans une
-- politique RLS, qui ne s'appliquerait qu'à certains appelants : un
-- déclencheur la fait respecter par TOUT LE MONDE, bureau et service compris.
-- Une donnée incohérente ne devient pas cohérente parce que c'est un
-- administrateur qui l'a écrite.
--
-- Idempotent — sans danger à rejouer.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. LES LIGNES DÉJÀ INCOHÉRENTES, S'IL Y EN A
--
-- On refuse d'installer une règle par-dessus des données qui la violent : le
-- déclencheur ne regarde que les écritures futures, et les lignes existantes
-- resteraient là, invisibles et actives. On les ferme d'abord, en le disant
-- dans la note pour que personne ne cherche l'explication ailleurs.
-- ---------------------------------------------------------------------------
UPDATE tool_assignments a
SET status = 'returned',
    actual_return_date = COALESCE(a.actual_return_date, CURRENT_DATE),
    notes = COALESCE(a.notes || ' — ', '') ||
            'Fermée : cette prise visait un outil ou un employé d''une autre entreprise.'
WHERE a.status <> 'returned'
  AND (
    NOT EXISTS (
      SELECT 1 FROM tools t
      WHERE t.id = a.tool_id AND t.company_id = a.company_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = a.employee_id AND e.company_id = a.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- 2. L'OUTIL ET L'EMPLOYÉ APPARTIENNENT À L'ENTREPRISE DÉCLARÉE
--
-- Les deux messages sont distincts : « outil d'une autre entreprise » et
-- « employé d'une autre entreprise » ne se corrigent pas de la même façon, et
-- un message unique enverrait chercher au mauvais endroit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tool_assignment_meme_entreprise()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tools t
    WHERE t.id = NEW.tool_id AND t.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Cet outil appartient à une autre entreprise.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = NEW.employee_id AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Cet employé appartient à une autre entreprise.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tool_assignments_meme_entreprise ON tool_assignments;
CREATE TRIGGER tool_assignments_meme_entreprise
  BEFORE INSERT OR UPDATE OF tool_id, employee_id, company_id ON tool_assignments
  FOR EACH ROW EXECUTE FUNCTION tool_assignment_meme_entreprise();

COMMENT ON FUNCTION tool_assignment_meme_entreprise() IS
  'Une prise reste dans une seule entreprise. Sans cela, l''index unique de 048 verrouillait l''outil d''un autre client depuis un compte étranger.';

-- ---------------------------------------------------------------------------
-- 3. L'INDEX UNIQUE PORTE DÉSORMAIS SUR LE COUPLE (ENTREPRISE, OUTIL)
--
-- Un `tool_id` est déjà unique dans toute la table, donc l'index de 048 était
-- correct EN SOI. Mais il exprimait « un outil, une sortie » là où la règle
-- est « un outil DE CETTE ENTREPRISE, une sortie ». Écrire la contrainte dans
-- les termes du domaine évite qu'un jour, un identifiant réutilisé ou une
-- fusion de bases ne transforme une garantie en refus mystérieux.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS tool_assignments_une_seule_active;

CREATE UNIQUE INDEX IF NOT EXISTS tool_assignments_une_seule_active
  ON tool_assignments (company_id, tool_id)
  WHERE status = 'active' AND actual_return_date IS NULL;

COMMENT ON INDEX tool_assignments_une_seule_active IS
  'Deux employés d''une même entreprise ne peuvent pas sortir le même outil en même temps. La course se joue dans la base, pas dans le code applicatif.';
