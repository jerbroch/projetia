/**
 * Contrôle de cohérence de la configuration Stripe, exécuté au démarrage.
 *
 * Le principe : Stripe est **facultatif** — sans `STRIPE_SECRET_KEY`,
 * l'application fonctionne en mode dégradé et les gardes `isStripeConfigured()`
 * font leur travail. Mais une configuration **partielle** est l'état dangereux :
 * le paiement paraît disponible, et l'échec ne se découvre qu'au clic d'un
 * client. Dès que la clé secrète est là, tout le reste devient obligatoire.
 *
 * Module pur : aucun accès réseau, aucune lecture de fichier. Il prend
 * l'environnement en paramètre pour rester testable.
 */
import { SUBSCRIPTION_TIERS } from "@/lib/billing/tiers";

export interface EnvProblem {
  /** Nom exact de la variable en cause, pour que le message soit actionnable. */
  variable: string;
  reason: string;
}

type Env = Record<string, string | undefined>;

const read = (env: Env, name: string): string => env[name]?.trim() ?? "";

/** Variables exigées dès que Stripe est configuré, hors Price IDs. */
const REQUIRED_WITH_STRIPE = [
  {
    variable: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    reason: "clé publique Stripe, requise côté navigateur",
  },
  {
    variable: "STRIPE_WEBHOOK_SECRET",
    reason:
      "signature des webhooks — sans elle, aucun paiement n'est enregistré en base",
  },
  {
    variable: "NEXT_PUBLIC_APP_URL",
    reason:
      "construit les URL de retour de Stripe (success_url, return_url du portail)",
  },
] as const;

/**
 * Retourne la liste des problèmes de configuration Stripe.
 * Vide = tout est cohérent, ou Stripe n'est pas configuré du tout.
 */
export function findStripeEnvProblems(env: Env = process.env): EnvProblem[] {
  const secretKey = read(env, "STRIPE_SECRET_KEY");
  if (!secretKey) return []; // Stripe volontairement absent : mode dégradé assumé.

  const problems: EnvProblem[] = [];

  for (const { variable, reason } of REQUIRED_WITH_STRIPE) {
    if (!read(env, variable)) problems.push({ variable, reason });
  }

  for (const tier of SUBSCRIPTION_TIERS) {
    for (const cycle of ["monthly", "annual"] as const) {
      const variable = tier.priceIdEnv[cycle];
      const value = read(env, variable);
      if (!value) {
        problems.push({
          variable,
          reason: `Price ID du palier ${tier.name} (${cycle === "annual" ? "annuel" : "mensuel"})`,
        });
      } else if (!value.startsWith("price_")) {
        problems.push({
          variable,
          reason: `un Stripe Price ID commence par « price_ », valeur reçue : « ${value.slice(0, 12)}… »`,
        });
      }
    }
  }

  // Mélanger les modes est silencieux chez Stripe et donne « No such price ».
  const publishable = read(env, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const secretLive = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
  const publishableLive = publishable.startsWith("pk_live_");
  if (publishable && secretLive !== publishableLive) {
    problems.push({
      variable: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      reason: `mode incohérent — la clé secrète est en ${secretLive ? "LIVE" : "TEST"} et la clé publique en ${publishableLive ? "LIVE" : "TEST"}`,
    });
  }

  // Une URL localhost en production casse tous les retours de paiement.
  const appUrl = read(env, "NEXT_PUBLIC_APP_URL");
  if (secretLive && /localhost|127\.0\.0\.1/.test(appUrl)) {
    problems.push({
      variable: "NEXT_PUBLIC_APP_URL",
      reason: `pointe sur « ${appUrl} » avec des clés LIVE — les retours de paiement mèneraient dans le vide`,
    });
  }

  return problems;
}

/** Message multiligne nommant chaque variable fautive. */
export function formatStripeEnvProblems(problems: EnvProblem[]): string {
  const lines = [
    `Configuration Stripe incomplète — ${problems.length} problème${problems.length > 1 ? "s" : ""} :`,
    "",
    ...problems.map((p) => `  • ${p.variable} — ${p.reason}`),
    "",
    "STRIPE_SECRET_KEY est renseignée, donc le paiement est censé fonctionner.",
    "Corrigez ces variables, ou retirez STRIPE_SECRET_KEY pour démarrer sans paiement.",
  ];
  return lines.join("\n");
}
