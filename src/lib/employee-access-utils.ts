import { isFieldWorkerRole } from "@/lib/field-permissions";
import type { ProfileRole } from "@/types";

export type EmployeeAppAccessStatus =
  | "none"
  | "invited"
  | "pending"
  | "active"
  | "inactive";

export function normalizeEmployeeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveEmployeeAppAccessStatus(
  row: Record<string, unknown>,
  opts?: { emailConfirmed?: boolean }
): EmployeeAppAccessStatus {
  if (!row.user_id) return "none";
  if (row.app_access_enabled === true) return "active";
  if (row.app_access_enabled === false && !row.app_access_invited_at) return "inactive";
  if (opts?.emailConfirmed === true) return "pending";
  if (row.app_access_invited_at) return "invited";
  return "inactive";
}

export function getEmployeeAppAccessStatusLabel(status: EmployeeAppAccessStatus): string {
  switch (status) {
    case "none":
      return "Aucun accès";
    case "invited":
      return "Invitation envoyée";
    case "pending":
      return "Invitation en attente";
    case "active":
      return "Accès actif";
    case "inactive":
      return "Accès désactivé";
  }
}

export function isOfficeRole(role: ProfileRole): boolean {
  return !isFieldWorkerRole(role);
}

export type ExistingProfileForAccess = {
  id: string;
  companyId: string;
  role: ProfileRole;
  employeeId: string | null;
};

export function validateEmployeeAccessEmail(params: {
  employeeEmail: string;
  adminUserId: string;
  adminEmail: string;
  existingProfile: ExistingProfileForAccess | null;
  companyId: string;
  employeeId: string;
}): string | null {
  const normalizedEmployeeEmail = normalizeEmployeeEmail(params.employeeEmail);
  const normalizedAdminEmail = normalizeEmployeeEmail(params.adminEmail);

  if (!normalizedEmployeeEmail) {
    return "Un courriel est requis pour donner accès à l'application.";
  }

  if (normalizedEmployeeEmail === normalizedAdminEmail) {
    return "Ce courriel correspond à votre compte administrateur. Utilisez un courriel distinct pour l'employé.";
  }

  const profile = params.existingProfile;
  if (!profile) return null;

  if (profile.id === params.adminUserId) {
    return "Ce courriel correspond à votre compte administrateur. Utilisez un courriel distinct pour l'employé.";
  }

  if (profile.companyId !== params.companyId) {
    return "Ce courriel est déjà utilisé par un autre compte.";
  }

  if (isOfficeRole(profile.role)) {
    return "Ce courriel est déjà utilisé par un compte administrateur ou bureau.";
  }

  if (profile.employeeId && profile.employeeId !== params.employeeId) {
    return "Ce courriel est déjà lié à un autre employé.";
  }

  return null;
}
