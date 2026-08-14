-- ConstructionIOS multi-company foundation
-- Run manually in Supabase SQL Editor or via Supabase CLI (do NOT auto-run in build)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled');
CREATE TYPE profile_role AS ENUM ('owner', 'admin', 'dispatcher', 'estimator', 'employee', 'accountant');
CREATE TYPE profile_status AS ENUM ('active', 'invited', 'inactive');
CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'lead');
CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'vacation', 'sick');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE payment_method AS ENUM ('card', 'ach', 'check', 'cash');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE schedule_status AS ENUM ('scheduled', 'in-progress', 'completed', 'cancelled');
CREATE TYPE schedule_type AS ENUM ('job', 'inspection', 'meeting', 'maintenance');
CREATE TYPE quote_request_status AS ENUM ('new', 'reviewed', 'quoted', 'declined');

-- updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  province TEXT DEFAULT 'QC',
  postal_code TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  gst_rate NUMERIC(5, 4) DEFAULT 0.05,
  qst_rate NUMERIC(5, 4) DEFAULT 0.09975,
  subscription_status subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_companies_subscription_status ON companies (subscription_status);

-- profiles (1:1 with auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role profile_role NOT NULL DEFAULT 'employee',
  status profile_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_profiles_company_id ON profiles (company_id);
CREATE INDEX idx_profiles_email ON profiles (email);

-- company_members (multi-company support)
CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role profile_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX idx_company_members_user_id ON company_members (user_id);
CREATE INDEX idx_company_members_company_id ON company_members (company_id);

-- customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  billing_address TEXT,
  company TEXT,
  status customer_status NOT NULL DEFAULT 'active',
  total_projects INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_customers_company_id ON customers (company_id);

-- employees
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  trade TEXT,
  truck_number TEXT,
  status employee_status NOT NULL DEFAULT 'active',
  notes TEXT,
  department TEXT,
  hire_date DATE,
  hourly_rate NUMERIC(10, 2),
  profile_photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_employees_company_id ON employees (company_id);

-- scheduled_jobs
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  billing_address TEXT,
  job_site_address TEXT,
  employee_ids UUID[] DEFAULT '{}',
  employee_names TEXT[] DEFAULT '{}',
  location TEXT,
  internal_notes TEXT,
  status schedule_status NOT NULL DEFAULT 'scheduled',
  type schedule_type NOT NULL DEFAULT 'job',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_scheduled_jobs_company_id ON scheduled_jobs (company_id);
CREATE INDEX idx_scheduled_jobs_start_at ON scheduled_jobs (start_at);

-- quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  customer_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status quote_status NOT NULL DEFAULT 'draft',
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, quote_number)
);

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_quotes_company_id ON quotes (company_id);

-- invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  customer_name TEXT,
  quote_id UUID REFERENCES quotes (id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, invoice_number)
);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_invoices_company_id ON invoices (company_id);

-- payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices (id) ON DELETE SET NULL,
  invoice_number TEXT,
  customer_name TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  method payment_method NOT NULL DEFAULT 'card',
  status payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payments_company_id ON payments (company_id);

-- quote_requests (public form submissions)
CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  project_description TEXT,
  address TEXT,
  status quote_request_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER quote_requests_updated_at
  BEFORE UPDATE ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_quote_requests_company_id ON quote_requests (company_id);

-- Helper: resolve company IDs for current user
CREATE OR REPLACE FUNCTION auth_user_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id FROM company_members WHERE user_id = auth.uid()
  UNION
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- companies policies
CREATE POLICY companies_select ON companies
  FOR SELECT USING (id IN (SELECT auth_user_company_ids()));

CREATE POLICY companies_update ON companies
  FOR UPDATE USING (
    id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
    )
  );

-- profiles policies
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- company_members policies (must not call auth_user_company_ids — it queries this table)
CREATE POLICY company_members_select ON company_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY company_members_manage ON company_members
  FOR ALL USING (
    company_id IN (
      SELECT p.company_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  );

-- Generic company isolation macro for business tables
CREATE POLICY customers_company_isolation ON customers
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY employees_company_isolation ON employees
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY scheduled_jobs_company_isolation ON scheduled_jobs
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY quotes_company_isolation ON quotes
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY invoices_company_isolation ON invoices
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY payments_company_isolation ON payments
  FOR ALL USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- quote_requests: public insert via service role; members can read own company
CREATE POLICY quote_requests_select ON quote_requests
  FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY quote_requests_insert ON quote_requests
  FOR INSERT WITH CHECK (company_id IN (SELECT auth_user_company_ids()));
