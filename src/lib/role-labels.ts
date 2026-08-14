import type { ProfileRole, UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Propriétaire",
  admin: "Admin",
  dispatcher: "Chargé de projet",
  estimator: "Estimateur",
  employee: "Employé terrain",
  accountant: "Comptable",
  manager: "Gestionnaire",
};

export function getRoleLabel(role: ProfileRole | UserRole | string | null | undefined): string {
  if (!role) return "Employé terrain";
  return ROLE_LABELS[role as UserRole] ?? role;
}

export { ROLE_LABELS };
