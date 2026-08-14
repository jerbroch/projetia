"use server";

import { redirect } from "next/navigation";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { companyHasAppAccess } from "@/lib/access-control";
import { isStripeConfigured } from "@/lib/stripe";
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
  plan: "monthly" | "annual",
): Promise<AccessActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Non disponible pour le compte de démonstration.");

  if (!isSupabaseConfigured()) {
    return safeError("Service indisponible.");
  }

  if (!isStripeConfigured()) {
    const admin = createAdminClient();
    await admin
      .from("companies")
      .update({ pending_plan: plan })
      .eq("id", ctx.company.id);
    return safeError("Paiement bientôt disponible. Votre choix a été enregistré.");
  }

  // Stripe checkout — price IDs not configured yet; do not fake success
  const admin = createAdminClient();
  await admin
    .from("companies")
    .update({ pending_plan: plan })
    .eq("id", ctx.company.id);

  return safeError(
    "Paiement bientôt disponible. La configuration Stripe Checkout sera activée prochainement.",
  );
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
