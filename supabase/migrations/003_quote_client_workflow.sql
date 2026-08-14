-- Quote client workflow: public token, status expansion, timestamps, deposit fields
-- Additive only — safe to re-run, does not delete data
--
-- IMPORTANT (Supabase SQL Editor):
-- Run PART 1 first, wait for success, then run PART 2 in a NEW query.
-- PostgreSQL requires new enum values to be committed before they can be referenced.

-- =============================================================================
-- PART 1 — Run this block first (separate query), then run PART 2
-- =============================================================================

ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'viewed';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'deposit_pending';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'deposit_paid';

-- =============================================================================
-- PART 2 — Run after PART 1 succeeds (new query)
-- =============================================================================

-- Deposit lifecycle for optional acceptance deposits
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_status') THEN
    CREATE TYPE deposit_status AS ENUM ('not_required', 'pending', 'paid');
  END IF;
END $$;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS public_token TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS deposit_status deposit_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stripe_deposit_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_public_token
  ON quotes (public_token)
  WHERE public_token IS NOT NULL;

-- Backfill tokens for quotes already sent (uses text cast — safe in same txn as enum adds)
-- Only existing statuses before migration; new statuses have no rows yet
UPDATE quotes
SET public_token = encode(gen_random_bytes(32), 'hex')
WHERE public_token IS NULL
  AND status::text IN ('sent', 'accepted', 'rejected', 'expired');
