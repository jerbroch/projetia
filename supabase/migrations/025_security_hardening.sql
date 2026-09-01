-- 025_security_hardening.sql
-- Supabase Security Advisor remediation (idempotent, compatible with 001–024).
-- Run manually in Supabase SQL Editor or via Supabase CLI — NOT auto-applied to production.
--
-- Fixes applied:
--   • SET search_path on set_updated_at, effective_catalog_price
--   • REVOKE EXECUTE FROM PUBLIC/anon on SECURITY DEFINER helpers; GRANT TO authenticated where RLS/RPC need it
--
-- Intentionally NOT fixed (see bottom):
--   • pg_trgm / pgcrypto in public schema (search indexes + gen_random_uuid defaults)
--   • company-logos bucket public=true (required for getPublicUrl in emails/docs; listing risk accepted)

-- =============================================================================
-- 1. search_path — trigger + utility functions flagged by Security Advisor
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION effective_catalog_price(
  p_custom_price NUMERIC,
  p_reference_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_custom_price, p_reference_price, 0);
$$;

-- =============================================================================
-- 2. EXECUTE privileges — RLS helper functions (authenticated only)
--    These run inside RLS policies; anon must not call them directly.
-- =============================================================================

REVOKE ALL ON FUNCTION public.auth_user_company_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_company_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_user_company_ids() TO authenticated;

REVOKE ALL ON FUNCTION public.auth_user_admin_company_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_admin_company_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_user_admin_company_ids() TO authenticated;

REVOKE ALL ON FUNCTION public.auth_user_employee_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_employee_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_user_employee_id() TO authenticated;

REVOKE ALL ON FUNCTION public.auth_user_has_office_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_has_office_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_user_has_office_role(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.auth_employee_assigned_to_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_employee_assigned_to_job(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_employee_assigned_to_job(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_platform_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated;

-- =============================================================================
-- 3. EXECUTE privileges — application RPCs (authenticated only, auth-checked inside)
-- =============================================================================

REVOKE ALL ON FUNCTION public.allocate_job_number(uuid, job_number_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.allocate_job_number(uuid, job_number_type) FROM anon;
GRANT EXECUTE ON FUNCTION public.allocate_job_number(uuid, job_number_type) TO authenticated;

REVOKE ALL ON FUNCTION public.seed_company_billing_defaults(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_company_billing_defaults(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.seed_company_billing_defaults(uuid) TO authenticated;

-- =============================================================================
-- 4. EXECUTE privileges — internal SECURITY DEFINER (no direct client access)
--    Called only from triggers or other SECURITY DEFINER functions during migrations/seeding.
-- =============================================================================

REVOKE ALL ON FUNCTION public._seed_labor_rate_templates(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._seed_labor_rate_templates(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._seed_labor_rate_templates(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public._seed_company_suppliers(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._seed_company_suppliers(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._seed_company_suppliers(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.log_company_created() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_company_created() FROM anon;
REVOKE ALL ON FUNCTION public.log_company_created() FROM authenticated;

REVOKE ALL ON FUNCTION public.log_feedback_sent() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_feedback_sent() FROM anon;
REVOKE ALL ON FUNCTION public.log_feedback_sent() FROM authenticated;

-- Trigger helper — not SECURITY DEFINER but lock down direct invocation
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;

-- Harmless immutable helper; revoke anon/direct public invocation anyway
REVOKE ALL ON FUNCTION public.effective_catalog_price(numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.effective_catalog_price(numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.effective_catalog_price(numeric, numeric) TO authenticated;

-- =============================================================================
-- 5. Storage — company-logos (document only; no bucket flag change)
-- =============================================================================
-- Bucket stays public=true so getCompanyLogoPublicUrl() works in quote/invoice emails.
-- company_logos_public_select (005) scopes object reads; listing all objects remains possible
-- on public buckets — migrate to signed URLs + private bucket in a future app change if needed.

-- =============================================================================
-- NOT FIXED — rationale
-- =============================================================================
-- pg_trgm (008): gin indexes on material_catalog_items search; moving to extensions schema
--   requires recreating indexes/operators — deferred to avoid breaking catalog search.
-- pgcrypto (001): gen_random_uuid() defaults across core tables; same migration risk.
-- company-logos public listing: intentional for email-embeddable logo URLs; low sensitivity
--   (logos only, one file per company folder, no PII).
