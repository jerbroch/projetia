-- Track employee app invitations separately from active access.
-- Idempotent — safe to re-run.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS app_access_invited_at TIMESTAMPTZ;
