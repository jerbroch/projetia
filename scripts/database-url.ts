/**
 * Resolves PostgreSQL connection strings for Prisma on Vercel and local dev.
 *
 * Runtime (pooled): DATABASE_URL → POSTGRES_PRISMA_URL → POSTGRES_URL
 * Migrations (direct): DIRECT_URL → POSTGRES_URL_NON_POOLING → runtime URL
 */

const RUNTIME_KEYS = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"] as const;
const DIRECT_KEYS = ["DIRECT_URL", "POSTGRES_URL_NON_POOLING"] as const;

function firstDefined(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getRuntimeDatabaseUrl(): string {
  const url = firstDefined(RUNTIME_KEYS);
  if (!url) {
    throw new Error(
      "No database URL found. Set DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL.",
    );
  }
  return url;
}

export function getDirectDatabaseUrl(): string {
  return firstDefined(DIRECT_KEYS) ?? getRuntimeDatabaseUrl();
}

/** Normalizes env vars so Prisma CLI and the app share one connection string. */
export function configureDatabaseEnv(): string {
  const runtimeUrl = getRuntimeDatabaseUrl();
  const directUrl = getDirectDatabaseUrl();

  process.env.DATABASE_URL = runtimeUrl;

  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = directUrl;
  }

  return runtimeUrl;
}
