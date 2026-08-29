import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PASSWORD_SETUP_PATH, shouldForcePasswordSetup } from "@/lib/password-setup-gate";
import { CHEMINS_DE_PORTE, porteDeProfil } from "@/lib/profile-access-gate";
import {
  chargerStatutDeProfil,
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
  "/heures",
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

/**
 * Redirige vers /login en conservant la destination COMPLÈTE (chemin + query)
 * dans `next`. Sans cela, `nextUrl.clone()` laisse la query d'origine collée à
 * /login (ex. /login?upgrade=1&next=/choose-plan) et le paramètre est perdu au
 * retour — on retomberait sur /choose-plan sans ?upgrade=1, donc au tableau
 * de bord.
 */
function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = request.nextUrl.clone();
  const destination = `${pathname}${request.nextUrl.search}`;
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", destination);
  return NextResponse.redirect(loginUrl);
}

/** Redirection interne simple : on ne traîne pas la query de la page d'origine. */
function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
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
  let userMetadata: unknown = null;

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
      userMetadata = user.user_metadata;
    }
  }

  if (isPublicRoute(pathname)) {
    return supabaseResponse;
  }

  const isDemo = hasDemoSession(request);

  if (isAccessGatePage(pathname)) {
    if (!isLoggedIn) {
      return redirectToLogin(request, pathname);
    }
    if (!emailVerified && !isDemo) {
      return redirectTo(request, "/verify-email");
    }
    return supabaseResponse;
  }

  if (isProtected(pathname)) {
    if (!isLoggedIn) {
      return redirectToLogin(request, pathname);
    }

    // Un employé invité a déjà une session, mais pas encore de mot de passe :
    // taper /terrain dans la barre d'adresse sauterait l'étape.
    if (!isDemo && shouldForcePasswordSetup({ pathname, isLoggedIn, metadata: userMetadata })) {
      return redirectTo(request, PASSWORD_SETUP_PATH);
    }

    // Un accès retiré doit fermer TOUT DE SUITE, avant les vérifications
    // d'abonnement. Jusqu'ici `profiles.status` était posé par la révocation
    // et lu par personne : la porte restait grande ouverte.
    if (supabase && userId && !isDemo) {
      const porte = porteDeProfil(await chargerStatutDeProfil(supabase, userId));
      if (porte !== "ouverte") {
        return redirectTo(request, CHEMINS_DE_PORTE[porte]);
      }
    }

    if (!emailVerified && pathname !== "/verify-email" && !isDemo) {
      return redirectTo(request, "/verify-email");
    }

    if (isTenantRoute(pathname) && supabase && userId && !isDemo) {
      const blocked = await shouldBlockTenantRoute(supabase, userId, isDemo);
      if (blocked) {
        return redirectTo(request, "/choose-plan");
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
    "/heures/:path*",
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
