import { redirect } from "next/navigation";
import { ChoosePlanClient } from "@/components/auth/choose-plan-client";
import { getPricingConfig } from "@/lib/pricing-config";
import { companyHasAppAccess } from "@/lib/access-control";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { isSuperAdminUser } from "@/lib/platform/super-admin";
import { requireVerifiedUser, getTenantContext } from "@/lib/session";

export default async function ChoosePlanPage() {
  await requireVerifiedUser();
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  if (ctx.isDemo) redirect("/dashboard");

  let pendingPlan: string | null = null;

  if (isSupabaseConfigured()) {
    const isPlatformAdmin = await isSuperAdminUser(ctx.user.id);
    const admin = createAdminClient();
    const { data: company } = await admin
      .from("companies")
      .select(
        "access_type, subscription_status, requires_access_choice, is_beta, created_at, last_activity_at, trial_ends_at, pending_plan",
      )
      .eq("id", ctx.company.id)
      .maybeSingle();

    if (company) {
      pendingPlan = company.pending_plan ? String(company.pending_plan) : null;

      const hasAccess = companyHasAppAccess(
        {
          accessType: company.access_type ? String(company.access_type) : null,
          subscriptionStatus: company.subscription_status
            ? String(company.subscription_status)
            : null,
          requiresAccessChoice:
            company.requires_access_choice != null
              ? Boolean(company.requires_access_choice)
              : null,
          isBeta: company.is_beta != null ? Boolean(company.is_beta) : null,
          createdAt: company.created_at ? String(company.created_at) : null,
          lastActivityAt: company.last_activity_at ? String(company.last_activity_at) : null,
          trialEndsAt: company.trial_ends_at ? String(company.trial_ends_at) : null,
        },
        { isPlatformAdmin },
      );

      if (hasAccess) redirect("/dashboard");
    }
  }

  const pricing = getPricingConfig();

  return (
    <ChoosePlanClient
      pricing={pricing}
      companyName={ctx.company.name}
      pendingPlan={pendingPlan}
    />
  );
}
