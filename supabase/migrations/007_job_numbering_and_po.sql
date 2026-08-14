-- Job numbering (CON/BT), client PO, and sequence counters per tenant/year/type

CREATE TYPE job_number_type AS ENUM ('contract', 'service_call');
CREATE TYPE job_origin AS ENUM ('quote', 'direct');

ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS job_number TEXT,
  ADD COLUMN IF NOT EXISTS job_number_type job_number_type,
  ADD COLUMN IF NOT EXISTS job_origin job_origin,
  ADD COLUMN IF NOT EXISTS client_po_number TEXT;

CREATE TABLE IF NOT EXISTS job_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  number_type job_number_type NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  UNIQUE (company_id, year, number_type)
);

CREATE INDEX IF NOT EXISTS idx_job_number_sequences_company
  ON job_number_sequences (company_id, year, number_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_jobs_company_job_number
  ON scheduled_jobs (company_id, job_number)
  WHERE job_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_archives
  ON scheduled_jobs (company_id, status, start_at DESC)
  WHERE status IN ('completed', 'cancelled');

CREATE OR REPLACE FUNCTION allocate_job_number(
  p_company_id UUID,
  p_number_type job_number_type
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_prefix TEXT;
  v_next INTEGER;
BEGIN
  IF p_company_id NOT IN (SELECT auth_user_company_ids()) THEN
    RAISE EXCEPTION 'Unauthorized company';
  END IF;

  IF p_number_type = 'contract' THEN
    v_prefix := 'CON';
  ELSE
    v_prefix := 'BT';
  END IF;

  INSERT INTO job_number_sequences (company_id, year, number_type, last_value)
  VALUES (p_company_id, v_year, p_number_type, 1)
  ON CONFLICT (company_id, year, number_type)
  DO UPDATE SET last_value = job_number_sequences.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

ALTER TABLE job_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_number_sequences_company_isolation ON job_number_sequences
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));
