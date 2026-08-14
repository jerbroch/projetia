import type { SupabaseClient } from "@supabase/supabase-js";
import {
  companyHasAppAccess,
  type CompanyAccessFields,
} from "@/lib/access-control";

function mapCompanyRow(row: Record<string, unknown>): CompanyAccessFields {
  return {
    accessType: row.access_type != null ? String(row.access_type) : null,
    subscriptionStatus:
      row.subscription_status != null ? String(row.subscription_status) : null,
    requiresAccessChoice:
      row.requires_access_choice != null ? Boolean(row.requires_access_choice) : null,
    isBeta: row.is_beta != null ? Boolean(row.is_beta) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    lastActivityAt: row.last_activity_at ? String(row.last_activity_at) : null,
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
  };
}

function isSchemaNotReady(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache");
}

export async function fetchCompanyAccessForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ companyId: string | null; fields: CompanyAccessFields | null; isPlatformAdmin: boolean }> {
  const [{ data: profile, error: profileError }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileError) {
    if (isSchemaNotReady(profileError.message)) {
      return { companyId: null, fields: null, isPlatformAdmin: false };
    }
  }

  const companyId = profile?.company_id ? String(profile.company_id) : null;
  if (!companyId) {
    return { companyId: null, fields: null, isPlatformAdmin: Boolean(adminRow) };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "access_type, subscription_status, requires_access_choice, is_beta, created_at, last_activity_at, trial_ends_at",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    if (isSchemaNotReady(companyError.message)) {
      return { companyId, fields: null, isPlatformAdmin: Boolean(adminRow) };
    }
    return { companyId, fields: null, isPlatformAdmin: Boolean(adminRow) };
  }

  return {
    companyId,
    fields: company ? mapCompanyRow(company) : null,
    isPlatformAdmin: Boolean(adminRow),
  };
}

export function userHasAppAccess(
  fields: CompanyAccessFields | null,
  options: { isDemo?: boolean; isPlatformAdmin?: boolean },
): boolean {
  if (options.isDemo) return true;
  if (!fields) return true;
  return companyHasAppAccess(fields, options);
}

export async function resolvePostLoginPath(
  supabase: SupabaseClient,
  userId: string,
  isDemo: boolean,
): Promise<string> {
  if (isDemo) return "/dashboard";

  const access = await fetchCompanyAccessForUser(supabase, userId);
  if (!access.companyId) return "/onboarding";

  if (
    userHasAppAccess(access.fields, { isPlatformAdmin: access.isPlatformAdmin })
  ) {
    return "/dashboard";
  }

  return "/choose-plan";
}

export async function shouldBlockTenantRoute(
  supabase: SupabaseClient,
  userId: string,
  isDemo: boolean,
): Promise<boolean> {
  if (isDemo) return false;

  const access = await fetchCompanyAccessForUser(supabase, userId);
  if (!access.fields) return false;

  return !userHasAppAccess(access.fields, { isPlatformAdmin: access.isPlatformAdmin });
}
