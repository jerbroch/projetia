-- ConstructionIOS platform admin (Super Admin)
-- Run manually in Supabase SQL Editor or via Supabase CLI

-- ---------------------------------------------------------------------------
-- Super admin registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admins_select ON platform_admins
  FOR SELECT USING (is_platform_super_admin());

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE admin_alert_type AS ENUM (
    'new_company',
    'new_subscription',
    'trial_started',
    'trial_ending',
    'subscription_cancelled',
    'failed_payment',
    'new_feedback',
    'inactive_company'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE admin_activity_event_type AS ENUM (
    'company_created',
    'subscription_activated',
    'plan_changed',
    'payment_received',
    'payment_failed',
    'subscription_cancelled',
    'feedback_sent',
    'feedback_treated',
    'alert_created'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE improvement_status AS ENUM (
    'to_analyze',
    'planned',
    'in_development',
    'completed',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE feedback_status AS ENUM ('new', 'reviewed', 'linked', 'treated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Company subscription tracking (Stripe / SaaS)
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer ON companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan_name TEXT,
  plan_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'cad',
  status TEXT NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER company_subscriptions_updated_at
  BEFORE UPDATE ON company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company ON company_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON company_subscriptions (status);

-- ---------------------------------------------------------------------------
-- Admin alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type admin_alert_type NOT NULL,
  company_id UUID REFERENCES companies (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_unread ON admin_alerts (created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_alerts_company ON admin_alerts (company_id);

-- ---------------------------------------------------------------------------
-- Admin activity log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type admin_activity_event_type NOT NULL,
  company_id UUID REFERENCES companies (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created ON admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_company ON admin_activity_log (company_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_event ON admin_activity_log (event_type);

-- ---------------------------------------------------------------------------
-- User feedback & improvements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status feedback_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  treated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_feedback_company ON platform_feedback (company_id);
CREATE INDEX IF NOT EXISTS idx_platform_feedback_status ON platform_feedback (status);

CREATE TABLE IF NOT EXISTS platform_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status improvement_status NOT NULL DEFAULT 'to_analyze',
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER platform_improvements_updated_at
  BEFORE UPDATE ON platform_improvements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_platform_improvements_status ON platform_improvements (status);

CREATE TABLE IF NOT EXISTS improvement_feedback_links (
  improvement_id UUID NOT NULL REFERENCES platform_improvements (id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES platform_feedback (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (improvement_id, feedback_id)
);

-- ---------------------------------------------------------------------------
-- Support mode sessions (architecture — disabled in app until security review)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_mode_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  read_only BOOLEAN NOT NULL DEFAULT TRUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  audit_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_mode_active ON support_mode_sessions (admin_user_id)
  WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS — platform tables (super admin only)
-- ---------------------------------------------------------------------------
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_feedback_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_mode_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_subscriptions_super_admin ON company_subscriptions
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());

CREATE POLICY admin_alerts_super_admin ON admin_alerts
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());

CREATE POLICY admin_activity_log_super_admin ON admin_activity_log
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());

CREATE POLICY platform_improvements_super_admin ON platform_improvements
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());

CREATE POLICY improvement_feedback_links_super_admin ON improvement_feedback_links
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());

CREATE POLICY support_mode_sessions_super_admin ON support_mode_sessions
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());

-- Feedback: tenants insert own; super admin reads all
CREATE POLICY platform_feedback_insert ON platform_feedback
  FOR INSERT WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
  );

CREATE POLICY platform_feedback_select ON platform_feedback
  FOR SELECT USING (
    company_id IN (SELECT auth_user_company_ids())
    OR is_platform_super_admin()
  );

CREATE POLICY platform_feedback_update_super_admin ON platform_feedback
  FOR UPDATE USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());

-- Super admin read access to all tenant data (SELECT only — no RLS bypass in browser)
CREATE POLICY companies_super_admin_select ON companies
  FOR SELECT USING (is_platform_super_admin());

CREATE POLICY profiles_super_admin_select ON profiles
  FOR SELECT USING (is_platform_super_admin());

CREATE POLICY customers_super_admin_select ON customers
  FOR SELECT USING (is_platform_super_admin());

CREATE POLICY quotes_super_admin_select ON quotes
  FOR SELECT USING (is_platform_super_admin());

CREATE POLICY invoices_super_admin_select ON invoices
  FOR SELECT USING (is_platform_super_admin());

CREATE POLICY payments_super_admin_select ON payments
  FOR SELECT USING (is_platform_super_admin());

CREATE POLICY scheduled_jobs_super_admin_select ON scheduled_jobs
  FOR SELECT USING (is_platform_super_admin());

CREATE POLICY quote_requests_super_admin_select ON quote_requests
  FOR SELECT USING (is_platform_super_admin());

-- ---------------------------------------------------------------------------
-- Triggers: auto-log & alert on new company
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_company_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_activity_log (event_type, company_id, description, metadata)
  VALUES (
    'company_created',
    NEW.id,
    'Nouvelle entreprise : ' || NEW.name,
    jsonb_build_object('company_name', NEW.name)
  );

  INSERT INTO admin_alerts (alert_type, company_id, title, description)
  VALUES (
    'new_company',
    NEW.id,
    'Nouvelle entreprise',
    NEW.name || ' s''est inscrite.'
  );

  IF NEW.subscription_status = 'trial' THEN
    INSERT INTO admin_alerts (alert_type, company_id, title, description)
    VALUES (
      'trial_started',
      NEW.id,
      'Essai démarré',
      NEW.name || ' a commencé un essai gratuit.'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_company_created ON companies;
CREATE TRIGGER trg_company_created
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION log_company_created();

CREATE OR REPLACE FUNCTION log_feedback_sent()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_activity_log (event_type, company_id, description, metadata)
  VALUES (
    'feedback_sent',
    NEW.company_id,
    'Commentaire reçu : ' || NEW.title,
    jsonb_build_object('feedback_id', NEW.id)
  );

  INSERT INTO admin_alerts (alert_type, company_id, title, description, metadata)
  VALUES (
    'new_feedback',
    NEW.company_id,
    'Nouveau commentaire',
    NEW.title,
    jsonb_build_object('feedback_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_feedback_sent ON platform_feedback;
CREATE TRIGGER trg_feedback_sent
  AFTER INSERT ON platform_feedback
  FOR EACH ROW EXECUTE FUNCTION log_feedback_sent();
