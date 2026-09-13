import { tierLabel } from "@/lib/billing/tiers";

/**
 * CE QUE L'EXPLOITANT APPREND, SANS OUVRIR L'APPLICATION.
 *
 * Les abonnements, annulations et échecs de paiement étaient écrits dans
 * `admin_activity_log` et nulle part ailleurs. Un journal qu'il faut penser à
 * ouvrir ne prévient de rien : un client peut annuler un mardi et personne ne
 * l'apprend avant la prochaine visite au tableau d'administration.
 *
 * Le courriel ne remplace pas le journal — il le double, pour les trois
 * événements qui demandent une réaction.
 */

export type EvenementAbonnement = "abonnement" | "annulation" | "echec_paiement";

export interface AvisAbonnement {
  evenement: EvenementAbonnement;
  nomEntreprise: string;
  tier: string | null;
  cycle: string | null;
  /** En cents, comme Stripe les donne. */
  montantCents?: number | null;
  devise?: string | null;
  statutStripe?: string | null;
}

function montantLisible(cents?: number | null, devise?: string | null): string | null {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) return null;
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: (devise || "cad").toUpperCase(),
  }).format(cents / 100);
}

function cycleLisible(cycle: string | null | undefined): string | null {
  if (cycle === "monthly") return "mensuel";
  if (cycle === "annual") return "annuel";
  return null;
}

/** Le sujet porte l'essentiel : beaucoup de courriels ne sont lus que là. */
export function sujetAvis(a: AvisAbonnement): string {
  const palier = tierLabel(a.tier);
  switch (a.evenement) {
    case "abonnement":
      return `Nouvel abonnement — ${a.nomEntreprise} (${palier})`;
    case "annulation":
      return `Annulation — ${a.nomEntreprise} (${palier})`;
    case "echec_paiement":
      return `Paiement refusé — ${a.nomEntreprise} (${palier})`;
  }
}

const TITRES: Record<EvenementAbonnement, string> = {
  abonnement: "Nouvel abonnement",
  annulation: "Abonnement annulé",
  echec_paiement: "Paiement refusé",
};

const COULEURS: Record<EvenementAbonnement, string> = {
  abonnement: "#15803d",
  annulation: "#b45309",
  echec_paiement: "#b91c1c",
};

const SUITES: Record<EvenementAbonnement, string> = {
  abonnement: "Rien à faire : l'accès est déjà ouvert.",
  annulation:
    "L'accès reste ouvert jusqu'à la fin de la période déjà payée. " +
    "Aucune donnée n'est effacée.",
  echec_paiement:
    "Stripe relancera le paiement automatiquement. L'accès reste ouvert " +
    "pendant les relances.",
};

function echapper(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function corpsAvis(a: AvisAbonnement): string {
  const lignes: Array<[string, string]> = [["Entreprise", a.nomEntreprise]];
  lignes.push(["Palier", tierLabel(a.tier)]);
  const cyc = cycleLisible(a.cycle);
  if (cyc) lignes.push(["Cycle", cyc]);
  const montant = montantLisible(a.montantCents, a.devise);
  if (montant) lignes.push(["Montant", montant]);
  if (a.statutStripe) lignes.push(["Statut Stripe", a.statutStripe]);

  const rangs = lignes
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7280;">${echapper(k)}</td>` +
        `<td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;font-weight:600;text-align:right;">${echapper(v)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;">
    <tr><td style="padding:24px 24px 8px 24px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${COULEURS[a.evenement]};">${TITRES[a.evenement]}</p>
    </td></tr>
    <tr><td style="padding:8px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rangs}</table>
    </td></tr>
    <tr><td style="padding:8px 24px 24px 24px;">
      <p style="margin:12px 0 0 0;padding-top:12px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">${SUITES[a.evenement]}</p>
    </td></tr>
  </table>
</body></html>`;
}
