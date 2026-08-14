import { createAdminClient } from "@/lib/supabase/admin";
import { assertSuperAdminConfigured } from "@/lib/platform/super-admin";
import {
  buildInactiveCompanyAlert,
  buildTrialEndingAlert,
  shouldCreateInactiveCompanyAlert,
  shouldCreateTrialEndingAlert,
} from "@/lib/platform/alerts";
import { buildAtRiskCompany } from "@/lib/platform/at-risk";
import { computeSaasMetrics } from "@/lib/platform/metrics";
import type {
  AdminActivityEntry,
  AdminAlert,
  AdminDashboardSummary,
  AtRiskCompany,
  CompanySubscription,
  CompanyUsageStats,
  PlatformCompanySummary,
  PlatformFeedback,
  PlatformImprovement,
  PlatformTestUser,
  SaasMetrics,
} from "@/types/platform";

function admin() {
  assertSuperAdminConfigured();
  return createAdminClient();
}

function mapAlert(row: Record<string, unknown>, companyName?: string): AdminAlert {
  return {
    id: String(row.id),
    alertType: row.alert_type as AdminAlert["alertType"],
    companyId: row.company_id ? String(row.company_id) : null,
    companyName,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapActivity(row: Record<string, unknown>, companyName?: string): AdminActivityEntry {
  return {
    id: String(row.id),
    eventType: row.event_type as AdminActivityEntry["eventType"],
    companyId: row.company_id ? String(row.company_id) : null,
    companyName,
    description: String(row.description),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

function mapCompany(row: Record<string, unknown>): PlatformCompanySummary {
  return {
    id: String(row.id),
    name: String(row.name),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    subscriptionStatus: String(row.subscription_status ?? "trial"),
    planName: row.plan_name ? String(row.plan_name) : null,
    accessType: row.access_type ? String(row.access_type) : null,
    isBeta: Boolean(row.is_beta),
    promoCode: row.promo_code ? String(row.promo_code) : null,
    promoCodeUsedAt: row.promo_code_used_at ? String(row.promo_code_used_at) : null,
    accessGrantedAt: row.access_granted_at ? String(row.access_granted_at) : null,
    subscriptionStartedAt: row.subscription_started_at
      ? String(row.subscription_started_at)
      : null,
    subscriptionEndsAt: row.subscription_ends_at ? String(row.subscription_ends_at) : null,
    pendingPlan: row.pending_plan ? String(row.pending_plan) : null,
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    createdAt: String(row.created_at),
    lastActivityAt: row.last_activity_at ? String(row.last_activity_at) : null,
    ownerName: null,
    ownerEmail: null,
    userCount: 0,
  };
}

function mapSubscription(row: Record<string, unknown>): CompanySubscription {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
    stripeSubscriptionId: row.stripe_subscription_id
      ? String(row.stripe_subscription_id)
      : null,
    planName: row.plan_name ? String(row.plan_name) : null,
    planAmountCents: Number(row.plan_amount_cents ?? 0),
    currency: String(row.currency ?? "cad"),
    status: String(row.status ?? "unknown"),
    currentPeriodStart: row.current_period_start
      ? String(row.current_period_start)
      : null,
    currentPeriodEnd: row.current_period_end ? String(row.current_period_end) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    createdAt: String(row.created_at),
  };
}

async function companyNameMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const db = admin();
  const { data } = await db.from("companies").select("id, name").in("id", ids);
  return new Map((data ?? []).map((r) => [String(r.id), String(r.name)]));
}

export async function syncDerivedAlerts(): Promise<void> {
  const db = admin();
  const { data: companies } = await db
    .from("companies")
    .select("id, name, subscription_status, trial_ends_at, last_activity_at");

  if (!companies) return;

  for (const company of companies) {
    const companyId = String(company.id);
    const companyName = String(company.name);

    if (
      shouldCreateTrialEndingAlert(
        String(company.subscription_status),
        company.trial_ends_at ? String(company.trial_ends_at) : null,
      )
    ) {
      const draft = buildTrialEndingAlert(
        companyId,
        companyName,
        String(company.trial_ends_at),
      );
      const { data: existing } = await db
        .from("admin_alerts")
        .select("id")
        .eq("alert_type", draft.alertType)
        .eq("company_id", companyId)
        .is("read_at", null)
        .maybeSingle();
      if (!existing) {
        await db.from("admin_alerts").insert({
          alert_type: draft.alertType,
          company_id: companyId,
          title: draft.title,
          description: draft.description,
          metadata: draft.metadata ?? {},
        });
      }
    }

    const lastLogin = await getCompanyLastLogin(companyId);
    if (
      shouldCreateInactiveCompanyAlert(
        company.last_activity_at ? String(company.last_activity_at) : null,
        lastLogin,
      )
    ) {
      const draft = buildInactiveCompanyAlert(companyId, companyName);
      const { data: existing } = await db
        .from("admin_alerts")
        .select("id")
        .eq("alert_type", draft.alertType)
        .eq("company_id", companyId)
        .is("read_at", null)
        .maybeSingle();
      if (!existing) {
        await db.from("admin_alerts").insert({
          alert_type: draft.alertType,
          company_id: companyId,
          title: draft.title,
          description: draft.description,
        });
      }
    }
  }
}

export async function getUnreadAlertCount(): Promise<number> {
  const db = admin();
  const { count } = await db
    .from("admin_alerts")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

export async function getAdminAlerts(limit = 50): Promise<AdminAlert[]> {
  const db = admin();
  const { data } = await db
    .from("admin_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))] as string[];
  const names = await companyNameMap(companyIds);

  return rows.map((r) => mapAlert(r, r.company_id ? names.get(String(r.company_id)) : undefined));
}

export async function getAdminActivityLog(options?: {
  search?: string;
  eventType?: string;
  limit?: number;
}): Promise<AdminActivityEntry[]> {
  const db = admin();
  let query = db
    .from("admin_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.eventType) query = query.eq("event_type", options.eventType);
  if (options?.search) query = query.ilike("description", `%${options.search}%`);

  const { data } = await query;
  const rows = data ?? [];
  const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))] as string[];
  const names = await companyNameMap(companyIds);

  return rows.map((r) =>
    mapActivity(r, r.company_id ? names.get(String(r.company_id)) : undefined),
  );
}

export async function getPlatformCompanies(): Promise<PlatformCompanySummary[]> {
  const db = admin();
  const { data: companies } = await db
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (!companies?.length) return [];

  const companyIds = companies.map((c) => String(c.id));

  const [{ data: owners }, { data: members }, testUsers] = await Promise.all([
    db
      .from("profiles")
      .select("id, company_id, first_name, last_name, email, role")
      .in("company_id", companyIds)
      .eq("role", "owner"),
    db.from("company_members").select("company_id").in("company_id", companyIds),
    loadTestUserMarkers(db),
  ]);

  const testUserIds = new Set(testUsers.map((t) => t.userId));
  const testCompanyIds = new Set(testUsers.map((t) => t.companyId).filter(Boolean));

  const ownerByCompany = new Map<string, { name: string; email: string; userId: string }>();
  for (const o of owners ?? []) {
    ownerByCompany.set(String(o.company_id), {
      name: `${o.first_name} ${o.last_name}`.trim(),
      email: String(o.email),
      userId: String(o.id),
    });
  }

  const userCounts = new Map<string, number>();
  for (const m of members ?? []) {
    const id = String(m.company_id);
    userCounts.set(id, (userCounts.get(id) ?? 0) + 1);
  }

  return companies.map((c) => {
    const summary = mapCompany(c);
    const owner = ownerByCompany.get(summary.id);
    summary.ownerName = owner?.name ?? null;
    summary.ownerEmail = owner?.email ?? null;
    summary.userCount = userCounts.get(summary.id) ?? 0;
    summary.isTestUser =
      testCompanyIds.has(summary.id) ||
      (owner?.userId != null && testUserIds.has(owner.userId));
    return summary;
  });
}

export async function getPlatformTestUsers(): Promise<PlatformTestUser[]> {
  const db = admin();
  const { data, error } = await db
    .from("platform_test_users")
    .select("user_id, email, company_id, created_by, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    if (isSchemaMissing(error.message)) return [];
    throw error;
  }

  const rows = data ?? [];
  const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))] as string[];
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];

  const [companyNames, creatorEmails] = await Promise.all([
    companyNameMap(companyIds),
    loadUserEmails(creatorIds),
  ]);

  return rows.map((row) => ({
    userId: String(row.user_id),
    email: String(row.email),
    companyId: row.company_id ? String(row.company_id) : null,
    companyName: row.company_id ? companyNames.get(String(row.company_id)) ?? null : null,
    createdAt: String(row.created_at),
    createdByEmail: creatorEmails.get(String(row.created_by)) ?? null,
  }));
}

function isSchemaMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache");
}

async function loadTestUserMarkers(
  db: ReturnType<typeof createAdminClient>,
): Promise<{ userId: string; companyId: string | null }[]> {
  const { data, error } = await db.from("platform_test_users").select("user_id, company_id");
  if (error) {
    if (isSchemaMissing(error.message)) return [];
    console.error("Failed to load platform test users:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    userId: String(row.user_id),
    companyId: row.company_id ? String(row.company_id) : null,
  }));
}

async function loadUserEmails(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const db = admin();
  const entries = await Promise.all(
    userIds.map(async (id) => {
      const { data } = await db.auth.admin.getUserById(id);
      return [id, data.user?.email ?? ""] as const;
    }),
  );
  return new Map(entries.filter(([, email]) => email));
}

export async function getPlatformCompany(companyId: string): Promise<PlatformCompanySummary | null> {
  const companies = await getPlatformCompanies();
  return companies.find((c) => c.id === companyId) ?? null;
}

async function getCompanyLastLogin(companyId: string): Promise<string | null> {
  const db = admin();
  const { data: members } = await db
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId);

  if (!members?.length) return null;

  let latest: string | null = null;
  for (const m of members) {
    const { data: userData } = await db.auth.admin.getUserById(String(m.user_id));
    const lastSignIn = userData.user?.last_sign_in_at;
    if (lastSignIn && (!latest || lastSignIn > latest)) latest = lastSignIn;
  }
  return latest;
}

export async function getCompanyUsageStats(companyId: string): Promise<CompanyUsageStats> {
  const db = admin();
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [
    lastLogin,
    { count: activeUsers },
    { count: clientsCount },
    { count: callsCount },
    { count: quotesCreated },
    { count: quotesSent },
    { count: invoicesCount },
    { count: activity7d },
    { count: activity30d },
  ] = await Promise.all([
    getCompanyLastLogin(companyId),
    db
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    db
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    db
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    db
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    db
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .neq("status", "draft"),
    db
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    db
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", d7),
    db
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", d30),
  ]);

  return {
    companyId,
    lastLogin,
    activeUsers: activeUsers ?? 0,
    clientsCount: clientsCount ?? 0,
    callsCount: callsCount ?? 0,
    quotesCreated: quotesCreated ?? 0,
    quotesSent: quotesSent ?? 0,
    invoicesCount: invoicesCount ?? 0,
    activity7d: activity7d ?? 0,
    activity30d: activity30d ?? 0,
  };
}

export async function getAtRiskCompanies(): Promise<AtRiskCompany[]> {
  const companies = await getPlatformCompanies();
  const db = admin();
  const results: AtRiskCompany[] = [];

  for (const company of companies) {
    const lastLogin = await getCompanyLastLogin(company.id);

    const { data: failedPayments } = await db
      .from("payments")
      .select("id")
      .eq("company_id", company.id)
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .limit(1);

    const atRisk = buildAtRiskCompany({
      companyId: company.id,
      companyName: company.name,
      subscriptionStatus: company.subscriptionStatus,
      trialEndsAt: company.trialEndsAt,
      lastLogin,
      lastActivityAt: company.lastActivityAt,
      hasRecentFailedPayment: (failedPayments?.length ?? 0) > 0,
    });

    if (atRisk) results.push(atRisk);
  }

  return results;
}

export async function getCompanySubscriptions(): Promise<CompanySubscription[]> {
  const db = admin();
  const { data } = await db
    .from("company_subscriptions")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapSubscription);
}

export async function getCompanySubscriptionHistory(
  companyId: string,
): Promise<CompanySubscription[]> {
  const db = admin();
  const { data } = await db
    .from("company_subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapSubscription);
}

export async function getSaasMetrics(): Promise<SaasMetrics> {
  const subscriptions = await getCompanySubscriptions();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeIds = new Set(
    subscriptions.filter((s) => s.status === "active").map((s) => s.companyId),
  );
  return computeSaasMetrics({
    subscriptions,
    activeCompanyIds: activeIds,
    periodStart,
    periodEnd: now,
  });
}

export async function getPlatformFeedback(): Promise<PlatformFeedback[]> {
  const db = admin();
  const { data } = await db
    .from("platform_feedback")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const companyIds = rows.map((r) => String(r.company_id));
  const names = await companyNameMap(companyIds);

  return rows.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    companyName: names.get(String(r.company_id)),
    userId: r.user_id ? String(r.user_id) : null,
    title: String(r.title),
    description: String(r.description),
    status: r.status as PlatformFeedback["status"],
    createdAt: String(r.created_at),
    treatedAt: r.treated_at ? String(r.treated_at) : null,
  }));
}

export async function getCompanyFeedback(companyId: string): Promise<PlatformFeedback[]> {
  const all = await getPlatformFeedback();
  return all.filter((f) => f.companyId === companyId);
}

export async function getPlatformImprovements(): Promise<PlatformImprovement[]> {
  const db = admin();
  const { data: improvements } = await db
    .from("platform_improvements")
    .select("*")
    .order("priority", { ascending: false });

  const { data: links } = await db.from("improvement_feedback_links").select("*");
  const { data: feedback } = await db.from("platform_feedback").select("id, company_id");

  const feedbackCompany = new Map(
    (feedback ?? []).map((f) => [String(f.id), String(f.company_id)]),
  );
  const companyIds = [...new Set((feedback ?? []).map((f) => String(f.company_id)))];
  const names = await companyNameMap(companyIds);

  return (improvements ?? []).map((imp) => {
    const linkedIds = (links ?? [])
      .filter((l) => String(l.improvement_id) === String(imp.id))
      .map((l) => String(l.feedback_id));

    const companyIdSet = new Set<string>();
    for (const fid of linkedIds) {
      const cid = feedbackCompany.get(fid);
      if (cid) companyIdSet.add(cid);
    }

    return {
      id: String(imp.id),
      title: String(imp.title),
      description: imp.description ? String(imp.description) : null,
      status: imp.status as PlatformImprovement["status"],
      priority: Number(imp.priority ?? 0),
      createdAt: String(imp.created_at),
      updatedAt: String(imp.updated_at),
      linkedFeedbackIds: linkedIds,
      interestedCompanies: [...companyIdSet].map((id) => ({
        id,
        name: names.get(id) ?? id,
      })),
    };
  });
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  await syncDerivedAlerts();

  const [unreadAlerts, metrics, atRisk, feedback, alerts] = await Promise.all([
    getUnreadAlertCount(),
    getSaasMetrics(),
    getAtRiskCompanies(),
    getPlatformFeedback(),
    getAdminAlerts(200),
  ]);

  const newFeedbackCount = feedback.filter((f) => f.status === "new").length;
  const failedPaymentsCount = alerts.filter((a) => a.alertType === "failed_payment" && !a.readAt)
    .length;

  return {
    unreadAlerts,
    payingCompanies: metrics.payingCompanies,
    atRiskCount: atRisk.length,
    newFeedbackCount,
    failedPaymentsCount,
    metrics,
  };
}

export async function logAdminActivity(
  eventType: AdminActivityEntry["eventType"],
  description: string,
  companyId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const db = admin();
  await db.from("admin_activity_log").insert({
    event_type: eventType,
    company_id: companyId ?? null,
    description,
    metadata: metadata ?? {},
  });
}
