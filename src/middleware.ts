import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  resolvePostLoginPath,
  shouldBlockTenantRoute,
  shouldRedirectFieldEmployeeFromAdmin,
} from "@/lib/middleware-access";

const TENANT_PREFIXES = [
  "/dashboard",
  "/customers",
  "/quotes",
  "/invoices",
  "/schedule",
  "/archives",
  "/reviews",
  "/employees",
  "/payments",
  "/settings",
  "/outillage",
  "/terrain",
];

const PROTECTED_PREFIXES = [...TENANT_PREFIXES, "/onboarding", "/admin"];

const AUTH_PAGES_REDIRECT_WHEN_LOGGED_IN = ["/login", "/register", "/forgot-password"];

const ACCESS_GATE_PAGES = ["/choose-plan"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProtected(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_PREFIXES);
}

function isTenantRoute(pathname: string): boolean {
  return matchesPrefix(pathname, TENANT_PREFIXES);
}

function shouldRedirectLoggedInFromAuthPage(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_PAGES_REDIRECT_WHEN_LOGGED_IN);
}

function isAccessGatePage(pathname: string): boolean {
  return matchesPrefix(pathname, ACCESS_GATE_PAGES);
}

function isPublicRoute(pathname: string): boolean {
  return pathname === "/soumission" || pathname.startsWith("/soumission/");
}

function hasDemoSession(request: NextRequest): boolean {
  return Boolean(request.cookies.get("constructionios_demo_session")?.value);
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  let isLoggedIn = hasDemoSession(request);
  let emailVerified = isLoggedIn;
  let userId: string | null = null;

  let supabase: ReturnType<typeof createServerClient> | null = null;

  if (url && anonKey) {
    supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      isLoggedIn = true;
      emailVerified = Boolean(user.email_confirmed_at);
      userId = user.id;
    }
  }

  if (isPublicRoute(pathname)) {
    return supabaseResponse;
  }

  const isDemo = hasDemoSession(request);

  if (isAccessGatePage(pathname)) {
    if (!isLoggedIn) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!emailVerified && !isDemo) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-email";
      return NextResponse.redirect(verifyUrl);
    }
    return supabaseResponse;
  }

  if (isProtected(pathname)) {
    if (!isLoggedIn) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!emailVerified && pathname !== "/verify-email" && !isDemo) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-email";
      return NextResponse.redirect(verifyUrl);
    }

    if (isTenantRoute(pathname) && supabase && userId && !isDemo) {
      const blocked = await shouldBlockTenantRoute(supabase, userId, isDemo);
      if (blocked) {
        const chooseUrl = request.nextUrl.clone();
        chooseUrl.pathname = "/choose-plan";
        return NextResponse.redirect(chooseUrl);
      }

      const fieldRedirect = await shouldRedirectFieldEmployeeFromAdmin(
        supabase,
        userId,
        pathname,
        isDemo,
      );
      if (fieldRedirect) {
        const terrainUrl = request.nextUrl.clone();
        terrainUrl.pathname = "/terrain";
        return NextResponse.redirect(terrainUrl);
      }
    }
  }

  if (shouldRedirectLoggedInFromAuthPage(pathname) && isLoggedIn) {
    let destination = "/dashboard";
    if (supabase && userId) {
      destination = await resolvePostLoginPath(supabase, userId, isDemo);
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = destination;
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === "/verify-email" && isLoggedIn && emailVerified && !isDemo) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    return NextResponse.redirect(onboardingUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/quotes/:path*",
    "/invoices/:path*",
    "/schedule/:path*",
    "/archives/:path*",
    "/reviews/:path*",
    "/employees/:path*",
    "/payments/:path*",
    "/settings/:path*",
    "/outillage/:path*",
    "/terrain/:path*",
    "/onboarding/:path*",
    "/choose-plan",
    "/admin",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/soumission/:path*",
  ],
};
