-- Fix company-logos storage RLS infinite recursion (503 "database schema is invalid or incompatible").
-- Storage policies must not query company_members/profiles directly — those tables' RLS policies
-- reference each other via auth_user_company_ids(), causing recursion during upload checks.

CREATE OR REPLACE FUNCTION auth_user_admin_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id
  FROM company_members
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  UNION
  SELECT company_id
  FROM profiles
  WHERE id = auth.uid() AND role IN ('owner', 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS company_logos_insert ON storage.objects;
DROP POLICY IF EXISTS company_logos_update ON storage.objects;
DROP POLICY IF EXISTS company_logos_delete ON storage.objects;
DROP POLICY IF EXISTS company_logos_select ON storage.objects;
DROP POLICY IF EXISTS company_logos_public_select ON storage.objects;

-- Owner/admin can upload logos only into their company folder: {company_id}/logo.ext
CREATE POLICY company_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT auth_user_admin_company_ids())
  );

-- Required for Storage API RETURNING after INSERT/upsert
CREATE POLICY company_logos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT auth_user_admin_company_ids())
  );

-- Public bucket — anyone can read logos (email clients, public quote pages)
CREATE POLICY company_logos_public_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'company-logos');

CREATE POLICY company_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT auth_user_admin_company_ids())
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT auth_user_admin_company_ids())
  );

CREATE POLICY company_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT auth_user_admin_company_ids())
  );
