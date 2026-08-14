-- Quote internal cost estimation (labor, materials, fees) + schedule snapshot.
-- Idempotent — safe to re-run.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS cost_estimation JSONB,
  ADD COLUMN IF NOT EXISTS calculated_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS proposed_amount NUMERIC(12, 2);

ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS quote_estimation_snapshot JSONB;

COMMENT ON COLUMN quotes.cost_estimation IS 'Internal quote cost breakdown: labor, materials, fees, client visibility flags, profitability schema';
COMMENT ON COLUMN quotes.calculated_cost IS 'Auto-calculated sell subtotal from cost estimation lines';
COMMENT ON COLUMN quotes.proposed_amount IS 'Manual client price override (before taxes)';
COMMENT ON COLUMN scheduled_jobs.quote_estimation_snapshot IS 'Frozen quote estimation when job is scheduled from quote';
