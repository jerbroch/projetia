-- Field employee access: user ↔ employee link, field hours/materials, scoped RLS
-- Idempotent — safe to re-run.

-- =============================================================================
-- 1. Link auth users to employee records
-- =============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS app_access_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id
  ON employees (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON profiles (employee_id);

-- Field notes on scheduled jobs (separate from internal_notes / work_description)
ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS field_notes TEXT,
  ADD COLUMN IF NOT EXISTS field_ready_for_review BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- 2. Real hours (field entry — separate from quote estimation / billing)
-- =============================================================================

CREATE TABLE IF NOT EXISTS field_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  scheduled_job_id UUID NOT NULL REFERENCES scheduled_jobs (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0),
  labor_type TEXT,
  notes TEXT,
  timer_started_at TIMESTAMPTZ,
  timer_stopped_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS field_hours_updated_at ON field_hours;
CREATE TRIGGER field_hours_updated_at
  BEFORE UPDATE ON field_hours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_field_hours_job ON field_hours (scheduled_job_id, work_date);
CREATE INDEX IF NOT EXISTS idx_field_hours_employee ON field_hours (employee_id);

-- =============================================================================
-- 3. Real materials (field entry — no financial columns)
-- =============================================================================

CREATE TABLE IF NOT EXISTS field_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  scheduled_job_id UUID NOT NULL REFERENCES scheduled_jobs (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  catalog_item_id UUID REFERENCES material_catalog_items (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'unité',
  notes TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS field_materials_updated_at ON field_materials;
CREATE TRIGGER field_materials_updated_at
  BEFORE UPDATE ON field_materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_field_materials_job ON field_materials (scheduled_job_id);
CREATE INDEX IF NOT EXISTS idx_field_materials_employee ON field_materials (employee_id);

-- =============================================================================
-- 4. RLS helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION auth_user_employee_id()
RETURNS UUID AS $$
  SELECT employee_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth_user_has_office_role()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin', 'dispatcher', 'estimator', 'accountant')
  )
  OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin', 'dispatcher', 'estimator', 'accountant')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth_employee_assigned_to_job(p_job_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM scheduled_jobs sj
    WHERE sj.id = p_job_id
      AND auth_user_employee_id() IS NOT NULL
      AND auth_user_employee_id() = ANY (sj.employee_ids)
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 5. scheduled_jobs — office full access, employees only assigned jobs
-- =============================================================================

DROP POLICY IF EXISTS scheduled_jobs_company_isolation ON scheduled_jobs;

CREATE POLICY scheduled_jobs_office_access ON scheduled_jobs
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  );

CREATE POLICY scheduled_jobs_employee_select ON scheduled_jobs
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_employee_id() IS NOT NULL
    AND auth_user_employee_id() = ANY (employee_ids)
  );

CREATE POLICY scheduled_jobs_employee_update ON scheduled_jobs
  FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_employee_id() IS NOT NULL
    AND auth_user_employee_id() = ANY (employee_ids)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_employee_id() IS NOT NULL
    AND auth_user_employee_id() = ANY (employee_ids)
  );

-- =============================================================================
-- 6. field_hours / field_materials RLS
-- =============================================================================

ALTER TABLE field_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS field_hours_office ON field_hours;
CREATE POLICY field_hours_office ON field_hours
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  );

DROP POLICY IF EXISTS field_hours_employee ON field_hours;
CREATE POLICY field_hours_employee ON field_hours
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND employee_id = auth_user_employee_id()
    AND auth_employee_assigned_to_job(scheduled_job_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND employee_id = auth_user_employee_id()
    AND auth_employee_assigned_to_job(scheduled_job_id)
  );

DROP POLICY IF EXISTS field_materials_office ON field_materials;
CREATE POLICY field_materials_office ON field_materials
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  );

DROP POLICY IF EXISTS field_materials_employee ON field_materials;
CREATE POLICY field_materials_employee ON field_materials
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND employee_id = auth_user_employee_id()
    AND auth_employee_assigned_to_job(scheduled_job_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND employee_id = auth_user_employee_id()
    AND auth_employee_assigned_to_job(scheduled_job_id)
  );

-- =============================================================================
-- 7. Billing / financial tables — office roles only (field employees blocked)
-- =============================================================================

DROP POLICY IF EXISTS job_billing_lines_company_isolation ON job_billing_lines;
CREATE POLICY job_billing_lines_office_only ON job_billing_lines
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  );

DROP POLICY IF EXISTS job_billing_sheets_company_isolation ON job_billing_sheets;
CREATE POLICY job_billing_sheets_office_only ON job_billing_sheets
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role()
  );
