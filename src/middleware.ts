import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PASSWORD_SETUP_PATH, shouldForcePasswordSetup } from "@/lib/password-setup-gate";
import { CHEMINS_DE_PORTE, porteDeProfil } from "@/lib/profile-access-gate";
import {
  TENANT_PREFIXES,
  chargerStatutDeProfil,
  resolvePostLoginPath,
  shouldBlockTenantRoute,
  shouldRedirectFieldEmployeeFromAdmin,
} from "@/lib/middleware-access";
import { deciderAcces, erreurDeDelaiDepasse } from "@/lib/auth/decision-acces";

// Importées : une seule source pour ce qui exige une session et ce qui est
// réservé au bureau (voir middleware-access.ts).

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

/** Le chemin de la page intermédiaire. Un seul endroit : elle doit être
 *  exclue du matcher ET reconnue comme publique. */
export const CHEMIN_VERIFICATION_IMPOSSIBLE = "/connexion-impossible";

function isPublicRoute(pathname: string): boolean {
  // `/connexion-impossible` en tête, et c'est ESSENTIEL : si elle était
  // protégée, une vérification impossible redirigerait vers une page qui
  // redirigerait vers une vérification impossible. La boucle ne se verrait
  // qu'en production, le jour où le réseau tombe pour de vrai — au moment
  // précis où plus personne ne peut rien ouvrir.
  //
  // Elle est déjà hors du matcher, donc le middleware ne tourne pas dessus.
  // Ceci est la deuxième barrière, pour que la protection tienne même si
  // quelqu'un élargit le matcher un jour.
  if (pathname === CHEMIN_VERIFICATION_IMPOSSIBLE) return true;
  return pathname === "/soumission" || pathname.startsWith("/soumission/");
}

/**
 * Une tentative de vérification, avec un plafond de temps.
 *
 * Une requête qui met trente secondes à échouer est pire qu'un échec en deux :
 * l'utilisateur voit une page blanche et ferme l'application. Passé le délai,
 * on rend une erreur rejouable — la même que pour un échec réseau — et la
 * décision suit le même chemin.
 */
const DELAI_PREMIERE_TENTATIVE_MS = 2000;
const DELAI_REESSAI_MS = 1500;

/*
 * POURQUOI `getUser` ET NON `getClaims`, MALGRÉ LES 44 ms.
 *
 * Mesuré : `getUser` interroge le serveur d'authentification en 44 ms,
 * `getClaims` vérifie la signature du jeton localement en 1 ms. Quarante
 * fois moins, sur chaque requête de l'application — la tentation est réelle.
 *
 * Elle a été écartée. Ce middleware ne contrôle pas seulement QUI est
 * connecté : il vérifie aussi que l'adresse est confirmée, par
 * `email_confirmed_at`. Or ce champ n'existe pas dans les claims du jeton.
 * Le seul équivalent disponible y est `user_metadata.email_verified` — et
 * `user_metadata` est modifiable par l'utilisateur lui-même. Fonder le
 * contrôle dessus rendrait la vérification d'adresse falsifiable par celui
 * qu'elle est censée arrêter.
 *
 * Quarante-quatre millisecondes ne valent pas ça.
 */
async function verifierAvecDelai(
  supabase: ReturnType<typeof createServerClient>,
  delaiMs: number,
): Promise<{ user: unknown; error: unknown }> {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      supabase.auth
        .getUser()
        .then((r: { data: { user: unknown }; error: unknown }) => ({
          user: r.data.user,
          error: r.error,
        }))
        .catch((e: unknown) => ({ user: null, error: e })),
      new Promise<{ user: unknown; error: unknown }>((resolve) => {
        minuterie = setTimeout(
          () => resolve({ user: null, error: erreurDeDelaiDepasse() }),
          delaiMs,
        );
      }),
    ]);
  } finally {
    if (minuterie) clearTimeout(minuterie);
  }
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
  let verificationImpossible = false;

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

    // Une tentative, puis UNE seule de plus si la première n'a pas abouti.
    // Ces échecs sont le plus souvent une requête tombée ; le réessai passe
    // sans que l'utilisateur voie quoi que ce soit. Le total est plafonné à
    // 3,5 secondes — au-delà, la page intermédiaire vaut mieux que l'attente.
    let resultat = await verifierAvecDelai(supabase, DELAI_PREMIERE_TENTATIVE_MS);
    let decision = deciderAcces(resultat);

    if (decision === "verification-impossible") {
      resultat = await verifierAvecDelai(supabase, DELAI_REESSAI_MS);
      decision = deciderAcces(resultat);
    }

    if (decision === "verification-impossible") {
      verificationImpossible = true;
    } else if (decision === "connecte") {
      const user = resultat.user as {
        id: string;
        email_confirmed_at?: string | null;
        user_metadata?: unknown;
      };
      isLoggedIn = true;
      emailVerified = Boolean(user.email_confirmed_at);
      userId = user.id;
      userMetadata = user.user_metadata;
    }
    // « non-connecte » laisse isLoggedIn à faux : c'est le comportement voulu,
    // et c'est un VERDICT de Supabase, pas une supposition tirée d'un silence.
  }

  if (isPublicRoute(pathname)) {
    return supabaseResponse;
  }

  // NI ACCÈS, NI CONNEXION. On ne sait pas qui est là : accorder l'accès
  // laisserait entrer quelqu'un qui n'est pas connecté, et renvoyer à la
  // connexion ferait retaper un mot de passe à quelqu'un dont la session est
  // valide. On le DIT, et on garde le témoin de session intact pour que le
  // bouton « Réessayer » suffise.
  if (verificationImpossible) {
    const url = request.nextUrl.clone();
    url.pathname = CHEMIN_VERIFICATION_IMPOSSIBLE;
    url.search = `?suite=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    // 503 : le service n'a pas pu répondre. Ce n'est ni un refus, ni un
    // succès — et les robots ne doivent pas l'indexer comme une page.
    return NextResponse.rewrite(url, { status: 503 });
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
    "/aide/:path*",
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
