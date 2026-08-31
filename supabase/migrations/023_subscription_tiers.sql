-- Paliers d'abonnement (Solo, Entreprise, Entrepreneur, Croissance)
-- Complète 022_subscription_billing.sql — Run dans le SQL Editor Supabase.
--
-- 022 stocke le CYCLE de facturation (subscription_plan = monthly | annual).
-- 023 ajoute le PALIER, qui détermine la limite d'utilisateurs.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT;

COMMENT ON COLUMN companies.subscription_tier IS
  'solo | entreprise | entrepreneur | croissance — palier payé (source: Stripe Price ID)';

CREATE INDEX IF NOT EXISTS idx_companies_subscription_tier
  ON companies (subscription_tier)
  WHERE subscription_tier IS NOT NULL;
