const TEST_TAG_REGEX = /^(.+)\+test(\d+)$/;

export interface ParsedEmail {
  localPart: string;
  domain: string;
  baseLocal: string;
}

export function parseEmailAddress(email: string): ParsedEmail | null {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null;

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!localPart || !domain.includes(".")) return null;

  const plusIndex = localPart.indexOf("+");
  const baseLocal = plusIndex >= 0 ? localPart.slice(0, plusIndex) : localPart;
  if (!baseLocal) return null;

  return { localPart, domain, baseLocal };
}

export function buildTestEmail(baseLocal: string, domain: string, index: number): string {
  return `${baseLocal}+test${index}@${domain}`;
}

export function extractTestIndex(email: string): number | null {
  const parsed = parseEmailAddress(email);
  if (!parsed) return null;
  const match = TEST_TAG_REGEX.exec(parsed.localPart);
  if (!match) return null;
  const index = Number(match[2]);
  return Number.isFinite(index) && index > 0 ? index : null;
}

export function resolveTestEmailBase(
  superAdminEmail: string,
  envBase?: string | null,
): ParsedEmail | null {
  const configured = envBase?.trim();
  if (configured) {
    return parseEmailAddress(configured);
  }
  return parseEmailAddress(superAdminEmail);
}

export function findNextTestEmailIndex(existingEmails: string[], baseLocal: string, domain: string): number {
  const used = new Set<number>();

  for (const email of existingEmails) {
    const parsed = parseEmailAddress(email);
    if (!parsed || parsed.domain !== domain || parsed.baseLocal !== baseLocal) continue;
    const index = extractTestIndex(email);
    if (index != null) used.add(index);
  }

  let next = 1;
  while (used.has(next)) next += 1;
  return next;
}

export function generateNextTestEmail(
  superAdminEmail: string,
  existingEmails: string[],
  envBase?: string | null,
): { email: string; method: "plus_addressing" | "env_base" } | null {
  const base = resolveTestEmailBase(superAdminEmail, envBase);
  if (!base) return null;

  const index = findNextTestEmailIndex(existingEmails, base.baseLocal, base.domain);
  const email = buildTestEmail(base.baseLocal, base.domain, index);
  return {
    email,
    method: envBase?.trim() ? "env_base" : "plus_addressing",
  };
}
