-- Platform test users (Super Admin dev tool)
-- Run manually in Supabase SQL Editor or via Supabase CLI

ALTER TYPE admin_activity_event_type ADD VALUE IF NOT EXISTS 'test_user_created';
ALTER TYPE admin_activity_event_type ADD VALUE IF NOT EXISTS 'test_user_deleted';

CREATE TABLE IF NOT EXISTS platform_test_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  company_id UUID REFERENCES companies (id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_test_users_created_by ON platform_test_users (created_by);
CREATE INDEX IF NOT EXISTS idx_platform_test_users_company ON platform_test_users (company_id)
  WHERE company_id IS NOT NULL;

ALTER TABLE platform_test_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_test_users_super_admin ON platform_test_users
  FOR ALL USING (is_platform_super_admin())
  WITH CHECK (is_platform_super_admin());
