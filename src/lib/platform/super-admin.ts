import { redirect } from "next/navigation";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session";
import type { User } from "@/types";

export class SuperAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuperAdminError";
  }
}

export async function isSuperAdminUser(userId: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error.message)) return false;
    console.error("Super admin check failed:", error.message);
    return false;
  }

  return Boolean(data);
}

function isSchemaMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache");
}

export async function requireSuperAdminUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.isDemo) {
    throw new SuperAdminError("Le mode démo n'a pas accès à l'administration plateforme.");
  }

  const isAdmin = await isSuperAdminUser(user.id);
  if (!isAdmin) {
    throw new SuperAdminError("Accès refusé — super administrateur requis.");
  }

  return user;
}

export function assertSuperAdminConfigured(): void {
  if (!isSupabaseAdminConfigured()) {
    throw new SuperAdminError("Supabase admin non configuré.");
  }
}
