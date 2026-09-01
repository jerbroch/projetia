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
): Promise<{
  companyId: string | null;
  fields: CompanyAccessFields | null;
  isPlatformAdmin: boolean;
  membershipRole: string | null;
  employeeId: string | null;
}> {
  const [{ data: profile, error: profileError }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("company_id, role, employee_id").eq("id", userId).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileError) {
    if (isSchemaNotReady(profileError.message)) {
      return {
        companyId: null,
        fields: null,
        isPlatformAdmin: false,
        membershipRole: null,
        employeeId: null,
      };
    }
  }

  const companyId = profile?.company_id ? String(profile.company_id) : null;
  if (!companyId) {
    return {
      companyId: null,
      fields: null,
      isPlatformAdmin: Boolean(adminRow),
      membershipRole: profile?.role ? String(profile.role) : null,
      employeeId: profile?.employee_id ? String(profile.employee_id) : null,
    };
  }

  const [{ data: company, error: companyError }, { data: member }] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "access_type, subscription_status, requires_access_choice, is_beta, created_at, last_activity_at, trial_ends_at",
      )
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("company_members")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (companyError) {
    if (isSchemaNotReady(companyError.message)) {
      return {
        companyId,
        fields: null,
        isPlatformAdmin: Boolean(adminRow),
        membershipRole: member?.role ? String(member.role) : profile?.role ? String(profile.role) : null,
        employeeId: profile?.employee_id ? String(profile.employee_id) : null,
      };
    }
    return {
      companyId,
      fields: null,
      isPlatformAdmin: Boolean(adminRow),
      membershipRole: member?.role ? String(member.role) : profile?.role ? String(profile.role) : null,
      employeeId: profile?.employee_id ? String(profile.employee_id) : null,
    };
  }

  return {
    companyId,
    fields: company ? mapCompanyRow(company) : null,
    isPlatformAdmin: Boolean(adminRow),
    membershipRole: member?.role ? String(member.role) : profile?.role ? String(profile.role) : null,
    employeeId: profile?.employee_id ? String(profile.employee_id) : null,
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
    if (access.membershipRole === "employee" && access.employeeId) {
      return "/terrain";
    }
    return "/dashboard";
  }

  return "/choose-plan";
}

/**
 * Routes de l'espace locataire, dans l'ordre où elles apparaissent.
 *
 * Source unique : le middleware l'importe pour décider ce qui exige une
 * session, et la liste d'administration en DÉRIVE.
 */
export const TENANT_PREFIXES = [
  "/dashboard",
  "/customers",
  "/quotes",
  "/invoices",
  "/schedule",
  "/archives",
  "/reviews",
  "/employees",
  "/outillage",
  "/payments",
  "/heures",
  "/settings",
  "/aide",
  "/terrain",
];

/** Le seul espace ouvert aux employés de terrain. */
export const FIELD_PREFIXES = ["/terrain"];

/**
 * Tout le reste est réservé au bureau — par DÉRIVATION, jamais par recopie.
 *
 * Cette liste était tenue à la main en parallèle de celle du middleware. En
 * ajoutant /heures j'ai oublié de la mettre à jour, et un employé de terrain
 * pouvait consulter les heures de TOUS ses collègues en tapant l'adresse.
 * Une nouvelle route est désormais réservée au bureau par défaut : l'oubli
 * ferme au lieu d'ouvrir.
 */
const ADMIN_TENANT_PREFIXES = TENANT_PREFIXES.filter((p) => !FIELD_PREFIXES.includes(p));

export function isAdminTenantRoute(pathname: string): boolean {
  return ADMIN_TENANT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function shouldRedirectFieldEmployeeFromAdmin(
  supabase: SupabaseClient,
  userId: string,
  pathname: string,
  isDemo: boolean,
): Promise<boolean> {
  if (isDemo) return false;
  if (!isAdminTenantRoute(pathname)) return false;

  const access = await fetchCompanyAccessForUser(supabase, userId);
  return access.membershipRole === "employee" && Boolean(access.employeeId);
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

/**
 * Statut du profil, pour la porte d'accès du middleware.
 *
 * Requête volontairement minuscule et séparée : elle tourne sur toute route
 * protégée, avant les vérifications d'abonnement, parce qu'un accès retiré
 * doit fermer immédiatement — pas après une cascade de lectures.
 *
 * Rend `null` quand aucun profil n'existe, ce que `porteDeProfil` interprète
 * comme « laisser passer » : c'est le cas d'un nouvel inscrit.
 */
export async function chargerStatutDeProfil(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  // Une lecture en échec ne doit pas verrouiller tout le monde : si le schéma
  // n'est pas prêt, on laisse les autres gardes décider.
  if (error) return null;
  return data?.status ? String(data.status) : null;
}
