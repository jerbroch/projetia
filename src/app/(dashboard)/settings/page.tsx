import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { BillingSettingsForm } from "@/components/settings/billing-settings-form";
import { FeedbackForm } from "@/components/settings/feedback-form";
import { InteracSettingsForm } from "@/components/settings/interac-settings-form";
import { requireTenantContext, hasAdminAccess } from "@/lib/session";

export default async function SettingsPage() {
  const ctx = await requireTenantContext();

  return (
    <DashboardLayout
      title="Paramètres"
      description="Configuration de votre entreprise"
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    >
      <div className="space-y-6">
        <CompanySettingsForm company={ctx.company} />
        {hasAdminAccess(ctx.membershipRole) && <InteracSettingsForm company={ctx.company} />}
        <BillingSettingsForm company={ctx.company} isDemo={ctx.isDemo} />
        {!ctx.isDemo && <FeedbackForm />}
      </div>
    </DashboardLayout>
  );
}
