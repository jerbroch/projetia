import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { BillingSettingsForm } from "@/components/settings/billing-settings-form";
import { FeedbackForm } from "@/components/settings/feedback-form";
import { SubscriptionSettingsForm } from "@/components/settings/subscription-settings-form";
import { InteracSettingsForm } from "@/components/settings/interac-settings-form";
import { requireTenantContext, hasAdminAccess } from "@/lib/session";
import { getCompanySubscriptionSummary } from "@/lib/billing/company-subscription";
import { getPricingConfig } from "@/lib/pricing-config";

export default async function SettingsPage() {
  const ctx = await requireTenantContext();
  const isCompanyAdmin = hasAdminAccess(ctx.membershipRole);
  const subscription = isCompanyAdmin
    ? await getCompanySubscriptionSummary(ctx.company.id)
    : null;

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
        {isCompanyAdmin && subscription && (
          <SubscriptionSettingsForm
            subscription={subscription}
            pricing={getPricingConfig()}
            isDemo={ctx.isDemo}
          />
        )}
        {isCompanyAdmin && <InteracSettingsForm company={ctx.company} />}
        <BillingSettingsForm company={ctx.company} isDemo={ctx.isDemo} />
        {!ctx.isDemo && <FeedbackForm />}
      </div>
    </DashboardLayout>
  );
}
