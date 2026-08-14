import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { DEMO_COMPANY_ID, DEMO_USER, isDemoLoginEnabled } from "./constants";

const DEMO_COOKIE = "constructionios_demo_session";

export interface DemoSessionPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  isDemo: true;
}

let devSecretWarningLogged = false;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.DEMO_SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET (or DEMO_SESSION_SECRET) is required in production for demo session signing.",
    );
  }

  if (!devSecretWarningLogged) {
    devSecretWarningLogged = true;
    console.warn(
      "[demo/session] AUTH_SECRET not set — using insecure dev fallback. Set AUTH_SECRET before production.",
    );
  }

  return "dev-demo-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export async function setDemoSession(): Promise<void> {
  if (!isDemoLoginEnabled()) {
    throw new Error("Demo login is disabled");
  }

  const payload: DemoSessionPayload = {
    userId: DEMO_USER.id,
    email: DEMO_USER.email,
    firstName: DEMO_USER.firstName,
    lastName: DEMO_USER.lastName,
    role: DEMO_USER.role,
    companyId: DEMO_COMPANY_ID,
    isDemo: true,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  const value = `${encoded}.${signature}`;

  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearDemoSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE);
}

export async function getDemoSession(): Promise<DemoSessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_COOKIE)?.value;
  if (!raw) return null;

  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as DemoSessionPayload;
    if (payload.isDemo !== true || payload.companyId !== DEMO_COMPANY_ID) return null;
    return payload;
  } catch {
    return null;
  }
}
