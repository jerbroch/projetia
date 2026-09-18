-- ---------------------------------------------------------------------------
-- LE TERRAIN PREND ET RETOURNE SES OUTILS LUI-MÊME
--
-- Jusqu'ici, `tool_assignments` n'était écrite que par le bureau (migration
-- 033). Un employé pouvait LIRE ses outils, jamais en prendre un ni en
-- retourner un : il devait appeler quelqu'un au bureau qui saisissait le
-- mouvement à sa place. Sur un chantier, cela signifie que l'inventaire est
-- toujours en retard sur la réalité.
--
-- Cette migration ouvre exactement deux gestes au terrain, et rien de plus :
--   • prendre un outil POUR SOI,
--   • fermer une prise QU'IL DÉTIENT.
--
-- Le catalogue reste fermé, l'historique reste inaltérable, et l'attribution
-- d'un collègue reste hors d'atteinte.
--
-- Idempotent — sans danger à rejouer.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. UNE SEULE PRISE ACTIVE PAR OUTIL, GARANTIE PAR LA BASE
--
-- La vérification de chevauchement se fait aujourd'hui en lisant puis en
-- écrivant : entre les deux, un second employé peut prendre le même outil.
-- Deux personnes repartent alors du dépôt avec la même perceuse, et
-- l'inventaire en montre une seule sortie.
--
-- Un index unique partiel règle la course au niveau où elle se joue. On
-- nettoie d'abord les doublons éventuels en fermant les plus anciens :
-- refuser de créer l'index laisserait la faille ouverte.
-- ---------------------------------------------------------------------------
WITH doublons AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY tool_id
           ORDER BY start_date DESC, created_at DESC, id
         ) AS rang
  FROM tool_assignments
  WHERE status = 'active' AND actual_return_date IS NULL
)
UPDATE tool_assignments a
SET status = 'returned',
    actual_return_date = COALESCE(a.actual_return_date, a.expected_return_date, CURRENT_DATE),
    notes = COALESCE(a.notes || ' — ', '') ||
            'Fermée automatiquement : deux prises actives coexistaient pour cet outil.'
FROM doublons d
WHERE a.id = d.id AND d.rang > 1;

CREATE UNIQUE INDEX IF NOT EXISTS tool_assignments_une_seule_active
  ON tool_assignments (tool_id)
  WHERE status = 'active' AND actual_return_date IS NULL;

COMMENT ON INDEX tool_assignments_une_seule_active IS
  'Deux employés ne peuvent pas sortir le même outil en même temps. La course se joue dans la base, pas dans le code applicatif.';

-- ---------------------------------------------------------------------------
-- 2. UN EMPLOYÉ PREND UN OUTIL — POUR LUI, ET SEULEMENT POUR LUI
--
-- `employee_id` doit être le sien : sans cette clause, un employé pourrait
-- sortir un outil au nom d'un collègue, qui se le verrait réclamer.
--
-- La prise est toujours 'active' : réserver pour plus tard reste un geste de
-- bureau, parce qu'il arbitre entre plusieurs personnes.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tool_assignments_field_prise ON tool_assignments;
CREATE POLICY tool_assignments_field_prise ON tool_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND employee_id = auth_user_employee_id()
    AND status = 'active'
    AND actual_return_date IS NULL
  );

-- ---------------------------------------------------------------------------
-- 3. UN EMPLOYÉ FERME UNE PRISE QU'IL DÉTIENT
--
-- `USING` décrit la ligne AVANT modification : elle doit lui appartenir et
-- être encore ouverte. `WITH CHECK` décrit la ligne APRÈS : elle doit rester
-- la sienne, sur le même outil.
--
-- Ce que ces deux clauses ne savent pas exprimer — « ne change QUE le retour »
-- — est confié au déclencheur du point 4. Une politique seule laisserait un
-- employé réécrire les dates de début ou les notes d'une prise passée.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tool_assignments_field_retour ON tool_assignments;
CREATE POLICY tool_assignments_field_retour ON tool_assignments
  FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND employee_id = auth_user_employee_id()
    AND status = 'active'
    AND actual_return_date IS NULL
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND employee_id = auth_user_employee_id()
  );

-- ---------------------------------------------------------------------------
-- 4. CE QU'UN RETOUR DE TERRAIN A LE DROIT DE CHANGER
--
-- Le déclencheur ne s'applique qu'aux employés SANS rôle de bureau : le
-- bureau garde ses corrections, y compris rouvrir ou rectifier une prise.
--
-- Un employé, lui, ne peut que clore : poser la date réelle, l'état du
-- retour, une note, et passer le statut à 'returned'. Tout le reste doit
-- rester identique — sinon « je retourne la perceuse » deviendrait un moyen
-- de réécrire l'historique de qui l'avait sortie et depuis quand.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tool_assignment_retour_terrain_limite()
RETURNS TRIGGER AS $$
BEGIN
  IF auth_user_has_office_role(NEW.company_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.tool_id IS DISTINCT FROM OLD.tool_id
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.expected_return_date IS DISTINCT FROM OLD.expected_return_date
     OR NEW.scheduled_job_id IS DISTINCT FROM OLD.scheduled_job_id
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Un retour de terrain ne modifie que la clôture de la prise.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status <> 'returned' OR NEW.actual_return_date IS NULL THEN
    RAISE EXCEPTION 'Un retour de terrain doit clore la prise avec sa date réelle.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tool_assignments_retour_terrain ON tool_assignments;
CREATE TRIGGER tool_assignments_retour_terrain
  BEFORE UPDATE ON tool_assignments
  FOR EACH ROW EXECUTE FUNCTION tool_assignment_retour_terrain_limite();

-- ---------------------------------------------------------------------------
-- 5. SIGNALER UN PROBLÈME SANS TOUCHER AU CATALOGUE
--
-- Un retour abîmé doit rendre l'outil indisponible. Mais `tools` reste fermée
-- au terrain — et doit le rester : sinon un employé pourrait renommer ou
-- reclasser n'importe quel outil de l'entreprise.
--
-- Cette fonction fait le seul changement légitime, et uniquement lui : passer
-- l'outil en réparation après un retour qu'on vient d'enregistrer. Elle
-- vérifie elle-même que l'appelant détenait bien l'outil, faute de quoi
-- `SECURITY DEFINER` deviendrait une porte ouverte sur tout le parc.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION signaler_outil_a_reparer(p_assignment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_tool_id UUID;
  v_company_id UUID;
BEGIN
  SELECT a.tool_id, a.company_id
    INTO v_tool_id, v_company_id
  FROM tool_assignments a
  WHERE a.id = p_assignment_id
    AND a.employee_id = auth_user_employee_id()
    AND a.company_id IN (SELECT auth_user_company_ids())
    AND a.actual_return_date IS NOT NULL;

  IF v_tool_id IS NULL THEN
    RAISE EXCEPTION 'Retour introuvable ou déjà clos par quelqu''un d''autre.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE tools
  SET base_status = 'in_repair'
  WHERE id = v_tool_id AND company_id = v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION signaler_outil_a_reparer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION signaler_outil_a_reparer(UUID) TO authenticated;

COMMENT ON FUNCTION signaler_outil_a_reparer(UUID) IS
  'Retour abîmé : passe l''outil en réparation. Seul changement de `tools` ouvert au terrain, et seulement sur un outil que l''appelant vient de rendre.';
