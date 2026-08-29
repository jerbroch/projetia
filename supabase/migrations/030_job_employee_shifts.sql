-- =============================================================================
-- Plage horaire d'UN employé sur UN call.
--
-- Jusqu'ici un call portait une seule plage (scheduled_jobs.start_at/end_at),
-- partagée par tous les employés assignés. Vérifié en navigateur : deux
-- employés d'un même call voyaient tous deux « 09:00 – 17:00 » sur leur
-- horaire. Le modèle ne savait pas exprimer qu'un gars commence à 8 h et
-- qu'un autre arrive l'après-midi.
--
-- La table naît VIDE et le restera pour les calls existants. Aucun
-- remplissage rétroactif : générer une plage par employé à partir de celle du
-- call reviendrait à INVENTER une donnée — affirmer « Marc a été planifié de
-- 9 h à 17 h » alors que personne ne l'a dit. En l'absence de plage,
-- l'application retombe sur celle du call, exactement comme avant.
--
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS job_employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  scheduled_job_id UUID NOT NULL REFERENCES scheduled_jobs (id) ON DELETE CASCADE,
  -- RESTRICT comme partout ailleurs sur employees : on archive, on ne supprime
  -- pas quelqu'un dont le travail est enregistré.
  employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Une plage qui finit avant de commencer n'a pas de sens, et fausserait tous
  -- les cumuls en y ajoutant des durées négatives.
  CONSTRAINT job_employee_shifts_ordre CHECK (end_at > start_at),
  -- Une seule plage par personne et par call : c'est le rectangle qu'on trace.
  CONSTRAINT job_employee_shifts_unique UNIQUE (scheduled_job_id, employee_id)
);

DROP TRIGGER IF EXISTS job_employee_shifts_updated_at ON job_employee_shifts;
CREATE TRIGGER job_employee_shifts_updated_at
  BEFORE UPDATE ON job_employee_shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_job_employee_shifts_job
  ON job_employee_shifts (scheduled_job_id);
CREATE INDEX IF NOT EXISTS idx_job_employee_shifts_employee
  ON job_employee_shifts (employee_id, start_at);

ALTER TABLE job_employee_shifts ENABLE ROW LEVEL SECURITY;

-- Le bureau gère les plages de son entreprise.
DROP POLICY IF EXISTS job_employee_shifts_office ON job_employee_shifts;
CREATE POLICY job_employee_shifts_office ON job_employee_shifts
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- L'employé LIT les plages des calls où il est assigné — toutes, pas seulement
-- la sienne : savoir qui arrive à quelle heure sur son chantier fait partie de
-- son travail. Il n'en écrit aucune : la planification appartient au bureau.
DROP POLICY IF EXISTS job_employee_shifts_employee_read ON job_employee_shifts;
CREATE POLICY job_employee_shifts_employee_read ON job_employee_shifts
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_employee_assigned_to_job(scheduled_job_id)
  );
