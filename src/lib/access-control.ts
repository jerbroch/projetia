/** Feature launch — companies created before this date are grandfathered (also handled in migration). */
export const SIGNUP_ACCESS_FEATURE_DATE = "2026-08-12T00:00:00Z";

export type CompanyAccessType =
  | "pending"
  | "monthly"
  | "annual"
  | "promo"
  | "beta"
  | "grandfathered";

export interface CompanyAccessFields {
  accessType?: string | null;
  subscriptionStatus?: string | null;
  requiresAccessChoice?: boolean | null;
  isBeta?: boolean | null;
  promoCode?: string | null;
  createdAt?: string | null;
  lastActivityAt?: string | null;
  trialEndsAt?: string | null;
}

export interface AccessCheckOptions {
  isDemo?: boolean;
  isPlatformAdmin?: boolean;
}

/**
 * Returns true when the company may use tenant app routes (/dashboard, etc.).
 */
export function companyHasAppAccess(
  company: CompanyAccessFields,
  options: AccessCheckOptions = {},
): boolean {
  if (options.isDemo) return true;
  if (options.isPlatformAdmin) return true;

  // Pre-migration: access columns absent — do not block existing tenants
  if (company.accessType == null && company.requiresAccessChoice == null) {
    return true;
  }

  const accessType = company.accessType ?? "pending";

  if (accessType === "grandfathered") return true;
  if (accessType === "beta" || accessType === "promo") return true;
  if (company.isBeta) return true;

  if (company.subscriptionStatus === "active") return true;

  if (accessType === "monthly" || accessType === "annual") {
    return company.subscriptionStatus === "active";
  }

  if (isGrandfatheredByActivity(company)) return true;

  return false;
}

/** In-memory / test helper when DB was not migrated yet. */
export function isGrandfatheredByActivity(company: CompanyAccessFields): boolean {
  if (company.lastActivityAt) return true;
  if (company.createdAt && company.createdAt < SIGNUP_ACCESS_FEATURE_DATE) return true;
  if (company.trialEndsAt) {
    const trialEnd = new Date(company.trialEndsAt);
    if (trialEnd > new Date()) return true;
  }
  return false;
}

export function accessTypeLabel(accessType: string | null | undefined): string {
  switch (accessType) {
    case "monthly":
      return "Mensuel";
    case "annual":
      return "Annuel";
    case "promo":
      return "Code promo";
    case "beta":
      return "Bêta";
    case "grandfathered":
      return "Accès existant";
    case "pending":
      return "En attente";
    default:
      return accessType ?? "—";
  }
}
