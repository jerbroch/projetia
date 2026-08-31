/**
 * Normalize North American phone numbers for SMS delivery.
 * Original display value should remain stored unchanged.
 */
export function normalizePhoneForSms(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (trimmed.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }

  return null;
}

export function isValidSmsPhone(phone: string): boolean {
  return normalizePhoneForSms(phone) !== null;
}
