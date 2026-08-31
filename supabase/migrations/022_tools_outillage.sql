-- Outillage (shared tools/equipment) module
-- Idempotent — safe to re-run.

-- Base tool status (stored; effective status also computed from assignments)
DO $$ BEGIN
  CREATE TYPE tool_base_status AS ENUM ('available', 'in_repair', 'out_of_service');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tool_condition AS ENUM ('good', 'damaged', 'needs_repair', 'missing_part', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tool_assignment_status AS ENUM ('active', 'reserved', 'returned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tool_return_condition AS ENUM ('good', 'damaged', 'needs_repair', 'missing_part', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tool_sms_status AS ENUM ('sent', 'failed', 'pending');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  internal_number TEXT,
  description TEXT,
  condition tool_condition NOT NULL DEFAULT 'good',
  base_status tool_base_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tools_company_id ON tools (company_id);
CREATE INDEX IF NOT EXISTS idx_tools_internal_number ON tools (company_id, internal_number);

DROP TRIGGER IF EXISTS tools_updated_at ON tools;
CREATE TRIGGER tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS tool_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  expected_return_date DATE NOT NULL,
  actual_return_date DATE,
  status tool_assignment_status NOT NULL DEFAULT 'active',
  notes TEXT,
  return_condition tool_return_condition,
  created_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tool_assignments_dates_check CHECK (expected_return_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_tool_assignments_company_id ON tool_assignments (company_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_tool_id ON tool_assignments (tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_employee_id ON tool_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_status ON tool_assignments (tool_id, status);

DROP TRIGGER IF EXISTS tool_assignments_updated_at ON tool_assignments;
CREATE TRIGGER tool_assignments_updated_at
  BEFORE UPDATE ON tool_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS tool_sms_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  status tool_sms_status NOT NULL DEFAULT 'sent',
  provider TEXT NOT NULL DEFAULT 'console',
  provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_sms_reminders_company_id ON tool_sms_reminders (company_id);
CREATE INDEX IF NOT EXISTS idx_tool_sms_reminders_tool_id ON tool_sms_reminders (tool_id, sent_at DESC);

-- RLS
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_sms_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tools_company_isolation ON tools;
CREATE POLICY tools_company_isolation ON tools
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

DROP POLICY IF EXISTS tool_assignments_company_isolation ON tool_assignments;
CREATE POLICY tool_assignments_company_isolation ON tool_assignments
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

DROP POLICY IF EXISTS tool_sms_reminders_company_isolation ON tool_sms_reminders;
CREATE POLICY tool_sms_reminders_company_isolation ON tool_sms_reminders
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

COMMENT ON TABLE tools IS 'Shared company tools/equipment inventory';
COMMENT ON TABLE tool_assignments IS 'Tool checkout, reservations, and return history';
COMMENT ON TABLE tool_sms_reminders IS 'Manual SMS reminder history for overdue tool returns';
