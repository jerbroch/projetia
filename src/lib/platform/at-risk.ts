import type { AtRiskCompany, AtRiskReason } from "@/types/platform";

const MS_PER_DAY = 86_400_000;

export interface AtRiskInput {
  companyId: string;
  companyName: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  lastLogin: string | null;
  lastActivityAt: string | null;
  hasRecentFailedPayment: boolean;
  now?: Date;
}

export function evaluateAtRiskReasons(input: AtRiskInput): AtRiskReason[] {
  const now = input.now ?? new Date();
  const reasons: AtRiskReason[] = [];

  if (input.lastLogin) {
    const daysSinceLogin =
      (now.getTime() - new Date(input.lastLogin).getTime()) / MS_PER_DAY;
    if (daysSinceLogin >= 14) reasons.push("no_login_14d");
  } else {
    reasons.push("no_login_14d");
  }

  const activityRef = input.lastActivityAt ?? input.lastLogin;
  if (activityRef) {
    const daysSinceActivity =
      (now.getTime() - new Date(activityRef).getTime()) / MS_PER_DAY;
    if (daysSinceActivity >= 30) reasons.push("no_activity_30d");
  } else {
    reasons.push("no_activity_30d");
  }

  if (input.hasRecentFailedPayment) reasons.push("failed_payment");
  if (input.subscriptionStatus === "past_due") reasons.push("overdue_subscription");

  if (input.subscriptionStatus === "trial" && input.trialEndsAt) {
    const daysUntilTrialEnd =
      (new Date(input.trialEndsAt).getTime() - now.getTime()) / MS_PER_DAY;
    if (daysUntilTrialEnd >= 0 && daysUntilTrialEnd <= 7) {
      reasons.push("trial_ending_no_conversion");
    }
  }

  return reasons;
}

export function isAtRisk(input: AtRiskInput): boolean {
  return evaluateAtRiskReasons(input).length > 0;
}

export function buildAtRiskCompany(input: AtRiskInput): AtRiskCompany | null {
  const reasons = evaluateAtRiskReasons(input);
  if (reasons.length === 0) return null;
  return {
    companyId: input.companyId,
    companyName: input.companyName,
    subscriptionStatus: input.subscriptionStatus,
    reasons,
    lastLogin: input.lastLogin,
    trialEndsAt: input.trialEndsAt,
  };
}
