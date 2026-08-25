"use server";

import { redirect } from "next/navigation";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { companyHasAppAccess } from "@/lib/access-control";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  createBillingPortalSession,
  createSubscriptionCheckoutSession,
  type CompanyBillingIdentity,
} from "@/lib/billing/checkout";
import { syncSubscriptionById } from "@/lib/billing/sync";
import {
  isBillingCycle,
  isSubscriptionTier,
  priceIdForTier,
  type BillingCycle,
  type SubscriptionTier,
} from "@/lib/billing/tiers";
import { logAdminActivity } from "@/lib/data/platform-data";
import {
  normalizePromoCode,
  promoValidationMessage,
  validatePromoCodeRecord,
} from "@/lib/promo-codes";
import { requireTenantContext } from "@/lib/session";
import { isSuperAdminUser } from "@/lib/platform/super-admin";

export type AccessActionResult =
  | { success: true; redirectTo?: string }
  | { success: false; error: string };

function safeError(message: string): AccessActionResult {
  return { success: false, error: message };
}

function billingIdentity(ctx: {
  company: { id: string; name: string };
  user: { email: string };
}): CompanyBillingIdentity {
  return {
    companyId: ctx.company.id,
    companyName: ctx.company.name,
    email: ctx.user.email,
  };
}

function isSchemaNotReady(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("does not exist");
}

async function fetchCompanyAccessRow(companyId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select(
      "id, access_type, subscription_status, requires_access_choice, is_beta, promo_code, created_at, last_activity_at, trial_ends_at, pending_plan",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function applyPromoCodeAction(formData: FormData): Promise<AccessActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Non disponible pour le compte de démonstration.");

  const rawCode = String(formData.get("code") ?? "");
  const code = normalizePromoCode(rawCode);
  if (!code) return safeError(promoValidationMessage("empty"));

  if (!isSupabaseConfigured()) {
    return safeError("Service indisponible — Supabase non configuré.");
  }

  const admin = createAdminClient();

  const { data: promoRow, error: promoError } = await admin
    .from("promo_codes")
    .select("code, free_access, active, expires_at")
    .ilike("code", code)
    .maybeSingle();

  if (promoError) {
    if (isSchemaNotReady(promoError.message)) {
      return safeError(
        "La migration d'accès (018_signup_access.sql) n'est pas encore appliquée.",
      );
    }
    console.error("Promo lookup failed:", promoError.message);
    return safeError("Impossible de valider le code. Réessayez.");
  }

  const validation = validatePromoCodeRecord(
    promoRow
      ? {
          code: String(promoRow.code),
          freeAccess: Boolean(promoRow.free_access),
          active: Boolean(promoRow.active),
          expiresAt: promoRow.expires_at ? String(promoRow.expires_at) : null,
        }
      : null,
  );

  if (!validation.valid) {
    return safeError(promoValidationMessage(validation.reason));
  }

  if (!validation.promo.freeAccess) {
    return safeError("Ce code promo ne donne pas accès gratuit. Choisissez un abonnement.");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("companies")
    .update({
      access_type: "beta",
      is_beta: true,
      promo_code: validation.promo.code,
      promo_code_used_at: now,
      access_granted_at: now,
      requires_access_choice: false,
      subscription_status: "active",
      pending_plan: null,
    })
    .eq("id", ctx.company.id);

  if (updateError) {
    if (isSchemaNotReady(updateError.message)) {
      return safeError(
        "La migration d'accès (018_signup_access.sql) n'est pas encore appliquée.",
      );
    }
    console.error("Promo apply failed:", updateError.message);
    return safeError("Impossible d'activer le code promo.");
  }

  try {
    await logAdminActivity(
      "subscription_activated",
      `Accès bêta activé via code ${validation.promo.code} — ${ctx.company.name}`,
      ctx.company.id,
      { promo_code: validation.promo.code, access_type: "beta" },
    );
  } catch {
    // Non-blocking if platform tables missing
  }

  redirect("/dashboard");
}

export async function selectSubscriptionPlanAction(
  tier: SubscriptionTier,
  cycle: BillingCycle,
): Promise<AccessActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Non disponible pour le compte de démonstration.");

  if (!isSubscriptionTier(tier) || !isBillingCycle(cycle)) {
    return safeError("Plan invalide.");
  }

  if (!isSupabaseConfigured()) {
    return safeError("Service indisponible.");
  }

  const admin = createAdminClient();

  // Le choix est enregistré même si le paiement échoue ensuite : il sert de
  // relance commerciale et pré-remplit la page d'abonnement au retour.
  await admin.from("companies").update({ pending_plan: cycle }).eq("id", ctx.company.id);

  if (!isStripeConfigured()) {
    return safeError("Paiement bientôt disponible. Votre choix a été enregistré.");
  }

  if (!priceIdForTier(tier, cycle)) {
    return safeError(
      "Paiement bientôt disponible — le tarif Stripe de ce palier n'est pas encore configuré.",
    );
  }

  try {
    const { url } = await createSubscriptionCheckoutSession(
      billingIdentity(ctx),
      tier,
      cycle,
    );
    return { success: true, redirectTo: url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isSchemaNotReady(message)) {
      return safeError(
        "La migration de facturation (022 / 023) n'est pas encore appliquée.",
      );
    }
    console.error("Stripe checkout failed:", message);
    return safeError("Impossible d'ouvrir le paiement. Réessayez dans un instant.");
  }
}

/** Portail Stripe : carte, factures, annulation — géré par Stripe. */
export async function openBillingPortalAction(
  returnPath = "/settings",
): Promise<AccessActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Non disponible pour le compte de démonstration.");

  if (!isStripeConfigured() || !isSupabaseConfigured()) {
    return safeError("Gestion de l'abonnement indisponible — Stripe n'est pas configuré.");
  }

  const safePath = returnPath.startsWith("/") ? returnPath : "/settings";

  try {
    const url = await createBillingPortalSession(billingIdentity(ctx), safePath);
    return { success: true, redirectTo: url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isSchemaNotReady(message)) {
      return safeError(
        "La migration de facturation (022 / 023) n'est pas encore appliquée.",
      );
    }
    console.error("Stripe billing portal failed:", message);
    return safeError("Impossible d'ouvrir la gestion de l'abonnement. Réessayez.");
  }
}

/**
 * Retour de Checkout : on lit l'abonnement chez Stripe et on l'applique tout de
 * suite, sans attendre le webhook (qui reste la source de vérité ensuite).
 */
export async function confirmCheckoutSessionAction(
  sessionId: string,
): Promise<AccessActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Non disponible pour le compte de démonstration.");
  if (!isStripeConfigured()) return safeError("Stripe n'est pas configuré.");
  if (!sessionId.startsWith("cs_")) return safeError("Session de paiement invalide.");

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    // Un identifiant de session est devinable : on refuse toute session qui
    // n'appartient pas à l'entreprise connectée.
    if (session.client_reference_id !== ctx.company.id) {
      return safeError("Session de paiement invalide.");
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      return safeError("Paiement en cours de traitement. Actualisez dans quelques secondes.");
    }

    const result = await syncSubscriptionById(subscriptionId, ctx.company.id);
    if (!result) {
      return safeError("Paiement en cours de traitement. Actualisez dans quelques secondes.");
    }

    try {
      await logAdminActivity(
        "subscription_activated",
        `Abonnement ${result.tier ?? "?"} (${result.cycle ?? "?"}) activé — ${ctx.company.name}`,
        ctx.company.id,
        { tier: result.tier, cycle: result.cycle, stripe_status: result.status },
      );
    } catch {
      // Non-blocking if platform tables missing
    }

    return { success: true, redirectTo: "/dashboard" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe checkout confirmation failed:", message);
    return safeError("Impossible de confirmer le paiement. Réessayez.");
  }
}

export async function getCompanyAccessStatusAction(): Promise<{
  hasAccess: boolean;
  accessType: string | null;
  pendingPlan: string | null;
}> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return { hasAccess: true, accessType: "grandfathered", pendingPlan: null };
  }

  if (!isSupabaseConfigured()) {
    return { hasAccess: true, accessType: null, pendingPlan: null };
  }

  const isPlatformAdmin = await isSuperAdminUser(ctx.user.id);

  try {
    const row = await fetchCompanyAccessRow(ctx.company.id);
    if (!row) {
      return { hasAccess: false, accessType: "pending", pendingPlan: null };
    }

    const hasAccess = companyHasAppAccess(
      {
        accessType: row.access_type ? String(row.access_type) : null,
        subscriptionStatus: row.subscription_status ? String(row.subscription_status) : null,
        requiresAccessChoice:
          row.requires_access_choice != null ? Boolean(row.requires_access_choice) : null,
        isBeta: row.is_beta != null ? Boolean(row.is_beta) : null,
        createdAt: row.created_at ? String(row.created_at) : null,
        lastActivityAt: row.last_activity_at ? String(row.last_activity_at) : null,
        trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
      },
      { isPlatformAdmin },
    );

    return {
      hasAccess,
      accessType: row.access_type ? String(row.access_type) : null,
      pendingPlan: row.pending_plan ? String(row.pending_plan) : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isSchemaNotReady(message)) {
      return { hasAccess: true, accessType: null, pendingPlan: null };
    }
    throw err;
  }
}
