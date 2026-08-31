-- Abonnement SaaS payant (Stripe Checkout + portail client)
-- Run manually in Supabase SQL Editor or via Supabase CLI

-- ---------------------------------------------------------------------------
-- Colonnes Stripe sur companies
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
  ADD COLUMN IF NOT EXISTS subscription_price_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN companies.stripe_customer_id IS 'Stripe Customer (cus_...) — un par entreprise';
COMMENT ON COLUMN companies.stripe_subscription_id IS 'Stripe Subscription (sub_...) active ou la plus récente';
COMMENT ON COLUMN companies.subscription_plan IS 'monthly | annual — plan payé (source: Stripe)';
COMMENT ON COLUMN companies.subscription_price_id IS 'Stripe Price (price_...) facturé';
COMMENT ON COLUMN companies.subscription_current_period_end IS 'Fin de la période payée en cours';
COMMENT ON COLUMN companies.subscription_cancel_at_period_end IS 'Annulation demandée — accès jusqu''à la fin de période';
-- subscription_status reste l'ENUM existant: on y ecrit le statut Stripe normalise
COMMENT ON COLUMN companies.subscription_status IS 'Statut Stripe normalise (enum): trial, active, past_due, cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_stripe_customer
  ON companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_stripe_subscription
  ON companies (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Journal des évènements Stripe (idempotence des webhooks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_company ON stripe_events (company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON stripe_events (processed_at DESC);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Écrit uniquement par le webhook (service role, qui contourne RLS).
-- Lecture réservée au super admin de la plateforme.
DROP POLICY IF EXISTS stripe_events_super_admin ON stripe_events;
CREATE POLICY stripe_events_super_admin ON stripe_events
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());
