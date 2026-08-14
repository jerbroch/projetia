-- Signup access flow: plan selection, promo codes, beta access
-- Run manually in Supabase SQL Editor or via Supabase CLI

-- ---------------------------------------------------------------------------
-- Promo codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  free_access BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_codes_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code_lower ON promo_codes (LOWER(code));

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Promo codes are validated server-side via service role only
CREATE POLICY promo_codes_super_admin ON promo_codes
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());

-- ---------------------------------------------------------------------------
-- Company access columns
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS promo_code_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_beta BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_access_choice BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS access_granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_plan TEXT;

COMMENT ON COLUMN companies.access_type IS 'pending | monthly | annual | promo | beta | grandfathered';
COMMENT ON COLUMN companies.pending_plan IS 'monthly | annual — selected but awaiting Stripe payment';

-- ---------------------------------------------------------------------------
-- Grandfather existing companies (do not break dev/test/production tenants)
-- ---------------------------------------------------------------------------
UPDATE companies
SET
  access_type = 'grandfathered',
  requires_access_choice = FALSE,
  access_granted_at = COALESCE(access_granted_at, created_at)
WHERE requires_access_choice = TRUE
  AND (
    created_at < TIMESTAMPTZ '2026-08-12T00:00:00Z'
    OR last_activity_at IS NOT NULL
    OR subscription_status = 'active'
    OR trial_ends_at IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- Seed beta promo code for testing
-- ---------------------------------------------------------------------------
INSERT INTO promo_codes (code, free_access, active, description)
VALUES ('ios123', TRUE, TRUE, 'Accès bêta gratuit — test interne')
ON CONFLICT (code) DO UPDATE
SET free_access = EXCLUDED.free_access,
    active = EXCLUDED.active,
    description = EXCLUDED.description;
