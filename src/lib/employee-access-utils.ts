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
  /**
   * De quoi NOMMER ce qui bloque. « Ce courriel est déjà utilisé par un autre
   * compte » ne dit ni où ni par qui : devant ce message, on ne peut ni
   * corriger ni décider. Ces deux champs existent pour que le refus soit
   * actionnable.
   */
  companyName?: string | null;
  personName?: string | null;
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

  const qui = profile.personName?.trim();

  if (profile.companyId !== params.companyId) {
    // Un compte d'une AUTRE entreprise. Rien à transférer ici : il ne vous
    // appartient pas. La seule issue est une autre adresse — autant le dire.
    const ou = profile.companyName?.trim();
    return (
      `Ce courriel sert déjà de compte${ou ? ` à l'entreprise « ${ou} »` : " sur une autre entreprise"}` +
      `${qui ? ` (${qui})` : ""}. Une adresse ne peut servir qu'à un seul compte : ` +
      "donnez-en une autre à cet employé."
    );
  }

  if (isOfficeRole(profile.role)) {
    return (
      `Ce courriel est celui d'un accès bureau${qui ? ` — ${qui}` : ""}. ` +
      "Un même compte ne peut pas être à la fois au bureau et sur le terrain : " +
      "donnez une adresse distincte à cet employé."
    );
  }

  if (profile.employeeId && profile.employeeId !== params.employeeId) {
    return (
      `Ce courriel est déjà lié à la fiche${qui ? ` de ${qui}` : " d'un autre employé"}. ` +
      "Retirez-le de cette fiche avant de le donner ici."
    );
  }

  return null;
}
