-- Link scheduled jobs to originating quotes (one job per quote)
ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_jobs_quote_id
  ON scheduled_jobs (quote_id)
  WHERE quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_quote_id_lookup
  ON scheduled_jobs (company_id, quote_id)
  WHERE quote_id IS NOT NULL;
