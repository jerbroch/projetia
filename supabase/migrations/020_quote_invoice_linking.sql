-- Quote → Invoice financial linking: deposit snapshot and quote reference on invoices.
-- Idempotent — safe to re-run.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_number TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices (quote_id)
  WHERE quote_id IS NOT NULL;
