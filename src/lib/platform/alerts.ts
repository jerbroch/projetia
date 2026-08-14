import type { AdminAlertType } from "@/types/platform";

export interface AlertDraft {
  alertType: AdminAlertType;
  companyId: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export function alertKey(draft: AlertDraft): string {
  return `${draft.alertType}:${draft.companyId ?? "global"}:${draft.title}`;
}

export function shouldCreateTrialEndingAlert(
  subscriptionStatus: string,
  trialEndsAt: string | null,
  now: Date = new Date(),
): boolean {
  if (subscriptionStatus !== "trial" || !trialEndsAt) return false;
  const daysUntil =
    (new Date(trialEndsAt).getTime() - now.getTime()) / 86_400_000;
  return daysUntil >= 0 && daysUntil <= 3;
}

export function shouldCreateInactiveCompanyAlert(
  lastActivityAt: string | null,
  lastLogin: string | null,
  now: Date = new Date(),
): boolean {
  const ref = lastActivityAt ?? lastLogin;
  if (!ref) return true;
  const daysSince = (now.getTime() - new Date(ref).getTime()) / 86_400_000;
  return daysSince >= 30;
}

export function buildTrialEndingAlert(
  companyId: string,
  companyName: string,
  trialEndsAt: string,
): AlertDraft {
  return {
    alertType: "trial_ending",
    companyId,
    title: "Essai se termine bientôt",
    description: `${companyName} — essai se termine le ${new Date(trialEndsAt).toLocaleDateString("fr-CA")}.`,
    metadata: { trialEndsAt },
  };
}

export function buildInactiveCompanyAlert(
  companyId: string,
  companyName: string,
): AlertDraft {
  return {
    alertType: "inactive_company",
    companyId,
    title: "Entreprise inactive",
    description: `${companyName} n'a montré aucune activité récente.`,
  };
}
