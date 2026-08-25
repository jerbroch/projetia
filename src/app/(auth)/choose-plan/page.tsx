import { redirect } from "next/navigation";
import { ChoosePlanClient } from "@/components/auth/choose-plan-client";
import { companyHasAppAccess } from "@/lib/access-control";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { isSuperAdminUser } from "@/lib/platform/super-admin";
import { requireVerifiedUser, getTenantContext } from "@/lib/session";
import { getCompanySubscriptionSummary } from "@/lib/billing/company-subscription";

interface ChoosePlanPageProps {
  searchParams: Promise<{ checkout?: string; session_id?: string; upgrade?: string }>;
}

export default async function ChoosePlanPage({ searchParams }: ChoosePlanPageProps) {
  const { checkout, session_id: sessionId, upgrade } = await searchParams;
  // ?upgrade=1 : l'utilisateur vient consulter les forfaits volontairement
  // (bouton des Paramètres). La page cesse alors d'être un portail
  // d'inscription et devient une page de tarifs — sans quoi tout compte ayant
  // déjà accès (grandfathered, bêta, promo, abonné) serait renvoyé au
  // tableau de bord. Voir la redirection plus bas.
  const isUpgradeView = upgrade === "1";
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

      // Au retour de Stripe on laisse la page confirmer la session avant de
      // rediriger : le webhook peut ne pas encore être arrivé.
      // Voir les tarifs ne donne accès à rien — l'accès aux routes applicatives
      // est gardé par le middleware, pas par cette redirection.
      if (hasAccess && checkout !== "success" && !isUpgradeView) {
        redirect("/dashboard");
      }
    }
  }

  // Palier courant : affiché comme « Forfait actuel » et sert à router le
  // changement de palier vers le portail Stripe plutôt qu'un nouveau Checkout.
  const subscription = isSupabaseConfigured()
    ? await getCompanySubscriptionSummary(ctx.company.id)
    : null;

  return (
    <ChoosePlanClient
      companyName={ctx.company.name}
      currentTier={subscription?.tier ?? null}
      currentCycle={subscription?.cycle ?? null}
      canSwitchTierInPortal={subscription?.canSwitchTierInPortal ?? false}
      pendingPlan={pendingPlan}
      checkoutStatus={checkout === "success" || checkout === "cancel" ? checkout : null}
      checkoutSessionId={sessionId ?? null}
    />
  );
}
