export interface PromoCodeRecord {
  code: string;
  freeAccess: boolean;
  active: boolean;
  expiresAt: string | null;
}

export type PromoValidationResult =
  | { valid: true; promo: PromoCodeRecord }
  | { valid: false; reason: PromoValidationReason };

export function normalizePromoCode(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validatePromoCodeRecord(
  promo: PromoCodeRecord | null | undefined,
  now: Date = new Date(),
): PromoValidationResult {
  if (!promo) {
    return { valid: false, reason: "not_found" };
  }
  if (!promo.active) {
    return { valid: false, reason: "inactive" };
  }
  if (promo.expiresAt) {
    const expires = new Date(promo.expiresAt);
    if (expires <= now) {
      return { valid: false, reason: "expired" };
    }
  }
  return { valid: true, promo };
}

export type PromoValidationReason = "empty" | "not_found" | "inactive" | "expired";

export function promoValidationMessage(reason: PromoValidationReason): string {
  switch (reason) {
    case "empty":
      return "Veuillez entrer un code promo.";
    case "not_found":
      return "Code promo invalide.";
    case "inactive":
      return "Ce code promo n'est plus actif.";
    case "expired":
      return "Ce code promo a expiré.";
    default:
      return "Code promo invalide.";
  }
}
