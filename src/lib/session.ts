import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { companyHasAppAccess } from "@/lib/access-control";
import { isFieldWorkerRole } from "@/lib/field-permissions";
import { DEMO_COMPANY, DEMO_USER } from "@/lib/demo/constants";
import { getDemoSession } from "@/lib/demo/session";
import { isSuperAdminUser } from "@/lib/platform/super-admin";
import type { Company, Profile, ProfileRole, TenantContext, User } from "@/types";
import { formatCompanyName } from "@/lib/company-display-name";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function getSessionUser(): Promise<User | null> {
  const demo = await getDemoSession();
  if (demo) {
    return {
      id: demo.userId,
      name: `${demo.firstName} ${demo.lastName}`,
      email: demo.email,
      role: demo.role as ProfileRole,
      companyId: demo.companyId,
      isDemo: true,
      emailVerified: true,
    };
  }

  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const firstName = (meta.first_name as string) ?? "";
  const lastName = (meta.last_name as string) ?? "";

  return {
    id: user.id,
    name: `${firstName} ${lastName}`.trim() || user.email || "Utilisateur",
    email: user.email ?? "",
    role: (meta.role as ProfileRole) ?? "employee",
    companyId: (meta.company_id as string) ?? "",
    isDemo: false,
    emailVerified: Boolean(user.email_confirmed_at),
  };
}

export async function requireSessionUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireVerifiedUser(): Promise<User> {
  const user = await requireSessionUser();
  if (!user.isDemo && !user.emailVerified) {
    redirect("/verify-email");
  }
  return user;
}

async function fetchCompanyFromDb(companyId: string): Promise<Company | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    name: formatCompanyName(String(data.name)),
    legalName: data.legal_name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    city: data.city,
    province: data.province,
    postalCode: data.postal_code,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    gstRate: Number(data.gst_rate),
    qstRate: Number(data.qst_rate),
    defaultMaterialMargin:
      data.default_material_margin != null ? Number(data.default_material_margin) : undefined,
    subscriptionStatus: data.subscription_status,
    trialEndsAt: data.trial_ends_at,
    accessType: data.access_type ? String(data.access_type) : undefined,
    promoCode: data.promo_code ? String(data.promo_code) : undefined,
    promoCodeUsedAt: data.promo_code_used_at ? String(data.promo_code_used_at) : undefined,
    isBeta: data.is_beta != null ? Boolean(data.is_beta) : undefined,
    requiresAccessChoice:
      data.requires_access_choice != null ? Boolean(data.requires_access_choice) : undefined,
    accessGrantedAt: data.access_granted_at ? String(data.access_granted_at) : undefined,
    subscriptionStartedAt: data.subscription_started_at
      ? String(data.subscription_started_at)
      : undefined,
    subscriptionEndsAt: data.subscription_ends_at ? String(data.subscription_ends_at) : undefined,
    pendingPlan: data.pending_plan ? String(data.pending_plan) : undefined,
    interac: {
      enabled: Boolean(data.interac_enabled),
      email: data.interac_email ? String(data.interac_email) : null,
      recipientName: data.interac_recipient_name ? String(data.interac_recipient_name) : null,
      securityQuestion: data.interac_security_question
        ? String(data.interac_security_question)
        : null,
      securityAnswer: data.interac_security_answer ? String(data.interac_security_answer) : null,
      instructions: data.interac_instructions ? String(data.interac_instructions) : null,
    },
    isDemo: false,
  };
}

async function fetchProfileFromDb(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    status: data.status,
    employeeId: data.employee_id ? String(data.employee_id) : null,
  };
}

async function fetchMembershipRoleFromDb(
  userId: string,
  companyId: string,
): Promise<ProfileRole | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  return data?.role ?? null;
}

async function fetchEmployeeIdForUser(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("employee_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.employee_id) return String(profile.employee_id);

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return employee?.id ? String(employee.id) : null;
}

function enrichUserFromProfile(user: User, profile: Profile | null, membershipRole: ProfileRole): User {
  const name = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : user.name;

  return {
    ...user,
    name: name || user.name,
    email: profile?.email || user.email,
    role: membershipRole,
    companyId: profile?.companyId || user.companyId,
  };
}

export async function getTenantContext(): Promise<TenantContext | null> {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.isDemo) {
    const membershipRole = DEMO_USER.role;
    return {
      user: {
        ...user,
        name: `${DEMO_USER.firstName} ${DEMO_USER.lastName}`,
        email: DEMO_USER.email,
        role: membershipRole,
        companyId: DEMO_USER.companyId,
      },
      profile: {
        id: DEMO_USER.id,
        companyId: DEMO_USER.companyId,
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        email: DEMO_USER.email,
        role: DEMO_USER.role,
        status: "active",
      },
      company: DEMO_COMPANY,
      membershipRole,
      employeeId: null,
      isDemo: true,
    };
  }

  const profile = await fetchProfileFromDb(user.id);
  const companyId = profile?.companyId || user.companyId;
  if (!companyId) return null;

  const company = (await fetchCompanyFromDb(companyId)) ?? {
    id: companyId,
    name: "Mon entreprise",
    isDemo: false,
  };

  const membershipRole =
    (await fetchMembershipRoleFromDb(user.id, companyId)) ?? profile?.role ?? "employee";

  const employeeId =
    profile?.employeeId ?? (await fetchEmployeeIdForUser(user.id));

  return {
    user: enrichUserFromProfile(user, profile, membershipRole),
    profile,
    company,
    membershipRole,
    employeeId,
    isDemo: false,
  };
}

export async function requireTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  if (!ctx.isDemo && !ctx.user.emailVerified) redirect("/verify-email");
  return ctx;
}

function isSchemaNotReady(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache");
}

export async function requireCompanyAccess(): Promise<TenantContext> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return ctx;

  if (!isSupabaseConfigured()) return ctx;

  const isPlatformAdmin = await isSuperAdminUser(ctx.user.id);

  let companyRow = ctx.company;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("companies")
      .select(
        "access_type, subscription_status, requires_access_choice, is_beta, created_at, last_activity_at, trial_ends_at",
      )
      .eq("id", ctx.company.id)
      .maybeSingle();

    if (error) {
      if (isSchemaNotReady(error.message)) return ctx;
      console.error("Company access check failed:", error.message);
      redirect("/choose-plan");
    }

    if (data) {
      companyRow = {
        ...ctx.company,
        accessType: data.access_type ? String(data.access_type) : undefined,
        subscriptionStatus: data.subscription_status ? String(data.subscription_status) : undefined,
        requiresAccessChoice:
          data.requires_access_choice != null
            ? Boolean(data.requires_access_choice)
            : undefined,
        isBeta: data.is_beta != null ? Boolean(data.is_beta) : undefined,
        trialEndsAt: data.trial_ends_at ? String(data.trial_ends_at) : undefined,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isSchemaNotReady(message)) return ctx;
    redirect("/choose-plan");
  }

  const hasAccess = companyHasAppAccess(
    {
      accessType: companyRow.accessType,
      subscriptionStatus: companyRow.subscriptionStatus,
      requiresAccessChoice: companyRow.requiresAccessChoice,
      isBeta: companyRow.isBeta,
      createdAt: undefined,
      lastActivityAt: undefined,
      trialEndsAt: companyRow.trialEndsAt,
    },
    { isPlatformAdmin },
  );

  if (!hasAccess) redirect("/choose-plan");
  return ctx;
}

export async function requireFieldContext(): Promise<TenantContext> {
  const ctx = await requireCompanyAccess();
  if (!isFieldWorkerRole(ctx.membershipRole)) {
    redirect("/dashboard");
  }
  if (!ctx.employeeId) {
    throw new AuthError("Accès terrain refusé — profil employé non lié");
  }
  if (ctx.profile?.status === "inactive") {
    throw new AuthError("Accès application désactivé");
  }
  return ctx;
}

export async function getPostLoginRedirectPath(): Promise<string> {
  const user = await getSessionUser();
  if (!user) return "/login";
  if (user.isDemo) return "/dashboard";
  if (!user.emailVerified) return "/verify-email";

  const ctx = await getTenantContext();
  if (!ctx?.company.id) return "/onboarding";

  if (!isSupabaseConfigured()) return "/dashboard";

  const isPlatformAdmin = await isSuperAdminUser(user.id);
  const hasAccess = companyHasAppAccess(
    {
      accessType: ctx.company.accessType,
      subscriptionStatus: ctx.company.subscriptionStatus,
      requiresAccessChoice: ctx.company.requiresAccessChoice,
      isBeta: ctx.company.isBeta,
      trialEndsAt: ctx.company.trialEndsAt,
    },
    { isPlatformAdmin },
  );

  if (!hasAccess) return "/choose-plan";

  if (isFieldWorkerRole(ctx.membershipRole) && ctx.employeeId) {
    return "/terrain";
  }

  return "/dashboard";
}

export function hasAdminAccess(role: ProfileRole): boolean {
  return role === "owner" || role === "admin";
}

export async function requireAdminContext(): Promise<TenantContext> {
  const ctx = await requireTenantContext();
  if (!hasAdminAccess(ctx.membershipRole)) {
    throw new AuthError("Accès refusé — droits administrateur requis");
  }
  return ctx;
}
