-- Company logo uploads via Supabase Storage (public URLs for email clients)
-- Apply manually in Supabase SQL Editor or via Supabase CLI
-- NOTE: Policies below cause RLS infinite recursion when evaluated during upload.
--       Apply 005_fix_company_logos_storage_rls.sql after this migration.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Owner/admin can upload logos only into their company folder: {company_id}/logo.ext
CREATE POLICY company_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.company_id::text
      FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
      UNION
      SELECT p.company_id::text
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY company_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.company_id::text
      FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
      UNION
      SELECT p.company_id::text
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.company_id::text
      FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
      UNION
      SELECT p.company_id::text
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  );

CREATE POLICY company_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.company_id::text
      FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
      UNION
      SELECT p.company_id::text
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  );
