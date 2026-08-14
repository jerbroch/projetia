import { notFound } from "next/navigation";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { CompanyDetailView } from "@/components/admin/company-detail-view";
import { SupportModeDisabledBanner } from "@/components/admin/support-mode-disabled-banner";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { buildAtRiskCompany } from "@/lib/platform/at-risk";
import {
  getCompanyFeedback,
  getCompanySubscriptionHistory,
  getCompanyUsageStats,
  getPlatformCompany,
  getUnreadAlertCount,
} from "@/lib/data/platform-data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCompanyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireSuperAdminUser();

  const [company, stats, subscriptions, feedback, unreadAlerts] = await Promise.all([
    getPlatformCompany(id),
    getCompanyUsageStats(id),
    getCompanySubscriptionHistory(id),
    getCompanyFeedback(id),
    getUnreadAlertCount(),
  ]);

  if (!company) notFound();

  const atRisk = buildAtRiskCompany({
    companyId: company.id,
    companyName: company.name,
    subscriptionStatus: company.subscriptionStatus,
    trialEndsAt: company.trialEndsAt,
    lastLogin: stats.lastLogin,
    lastActivityAt: company.lastActivityAt,
    hasRecentFailedPayment: false,
  });

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title={company.name}
      description="Profil complet de l'entreprise"
    >
      <div className="space-y-6">
        <SupportModeDisabledBanner />
        <CompanyDetailView
          company={company}
          stats={stats}
          subscriptions={subscriptions}
          feedback={feedback}
          atRiskReasons={atRisk?.reasons ?? []}
        />
      </div>
    </AdminLayoutShell>
  );
}
