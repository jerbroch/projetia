-- Fix infinite recursion in company_members RLS policies.
-- auth_user_company_ids() queries company_members, so company_members SELECT
-- must not call it (recursion). Use direct user/company checks instead.

DROP POLICY IF EXISTS company_members_select ON company_members;
DROP POLICY IF EXISTS company_members_manage ON company_members;

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
