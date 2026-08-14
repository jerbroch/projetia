import type { CompanySubscription, SaasMetrics } from "@/types/platform";

export interface SubscriptionMetricsInput {
  subscriptions: CompanySubscription[];
  activeCompanyIds: Set<string>;
  periodStart: Date;
  periodEnd: Date;
}

function monthlyAmount(sub: CompanySubscription): number {
  if (sub.status === "cancelled" || sub.status === "canceled") return 0;
  return sub.planAmountCents / 100;
}

export function computeSaasMetrics(input: SubscriptionMetricsInput): SaasMetrics {
  const { subscriptions, activeCompanyIds, periodStart, periodEnd } = input;

  if (subscriptions.length === 0) {
    return {
      available: false,
      mrr: 0,
      arr: 0,
      arpu: 0,
      newMrr: 0,
      lostMrr: 0,
      churnRate: 0,
      newSubscriptions: 0,
      cancellations: 0,
      trialConversions: 0,
      payingCompanies: 0,
      currency: "cad",
    };
  }

  const activeSubs = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing",
  );
  const mrr = activeSubs.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const payingCompanies = new Set(
    activeSubs.filter((s) => s.status === "active").map((s) => s.companyId),
  ).size;

  const newSubs = subscriptions.filter((s) => {
    const created = new Date(s.createdAt);
    return created >= periodStart && created <= periodEnd;
  });

  const cancelledInPeriod = subscriptions.filter((s) => {
    if (!s.cancelledAt) return false;
    const cancelled = new Date(s.cancelledAt);
    return cancelled >= periodStart && cancelled <= periodEnd;
  });

  const newMrr = newSubs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + monthlyAmount(s), 0);

  const lostMrr = cancelledInPeriod.reduce((sum, s) => sum + monthlyAmount(s), 0);

  const trialConversions = subscriptions.filter((s) => {
    if (s.status !== "active") return false;
    const created = new Date(s.createdAt);
    return created >= periodStart && created <= periodEnd;
  }).length;

  const startPaying = activeCompanyIds.size || payingCompanies;
  const churnRate =
    startPaying > 0 ? (cancelledInPeriod.length / startPaying) * 100 : 0;

  return {
    available: true,
    mrr,
    arr: mrr * 12,
    arpu: payingCompanies > 0 ? mrr / payingCompanies : 0,
    newMrr,
    lostMrr,
    churnRate,
    newSubscriptions: newSubs.length,
    cancellations: cancelledInPeriod.length,
    trialConversions,
    payingCompanies,
    currency: subscriptions[0]?.currency ?? "cad",
  };
}
