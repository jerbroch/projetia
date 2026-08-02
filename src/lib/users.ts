import bcrypt from "bcryptjs";
import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const DEFAULT_ADMIN = {
  email: "admin@constructionos.com",
  password: "Admin123!",
  name: "Admin User",
  role: "admin" as UserRole,
  companyId: "company-1",
};

const ADMIN_EMAIL = DEFAULT_ADMIN.email.toLowerCase();

const BCRYPT_ROUNDS = 12;

let ensureAdminPromise: Promise<void> | null = null;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function ensureDefaultAdmin(): Promise<void> {
  const passwordHash = await hashPassword(DEFAULT_ADMIN.password);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: DEFAULT_ADMIN.name,
      password: passwordHash,
      role: DEFAULT_ADMIN.role,
      companyId: DEFAULT_ADMIN.companyId,
    },
    create: {
      name: DEFAULT_ADMIN.name,
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: DEFAULT_ADMIN.role,
      companyId: DEFAULT_ADMIN.companyId,
    },
  });
}

export function ensureDefaultAdminOnce(): Promise<void> {
  if (!ensureAdminPromise) {
    ensureAdminPromise = ensureDefaultAdmin().catch((error) => {
      ensureAdminPromise = null;
      throw error;
    });
  }

  return ensureAdminPromise;
}

export async function authenticateUser(email: string, password: string) {
  await ensureDefaultAdminOnce();

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  };
}
