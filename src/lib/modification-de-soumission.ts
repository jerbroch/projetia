import type { Quote, QuoteStatus } from "@/types";

/**
 * Ce qui arrive quand on modifie une soumission déjà partie chez le client.
 *
 * Une soumission envoyée reste visible au MÊME lien : la modifier change ce que
 * le client voit, sans qu'il en soit averti. Éprouvé — une soumission passée de
 * 5 000 $ à 7 500 $ gardait son statut « envoyée », son jeton, et affichait le
 * nouveau montant. Le client qui l'avait lue la veille voyait autre chose le
 * lendemain, sans un mot.
 *
 * Trois régimes, selon ce que le client a déjà fait :
 *
 *   brouillon              → on modifie librement, personne ne l'a vue
 *   envoyée ou consultée   → on AVERTIT, puis on laisse faire
 *   acceptée ou dépôt payé → on REFUSE, et on propose une révision
 *
 * Le troisième cas n'est pas une précaution : une soumission acceptée est un
 * accord. La changer sous les yeux du client après qu'il a dit oui — ou pire,
 * après qu'il a versé un dépôt — c'est modifier un contrat tout seul.
 */
export type RegimeDeModification = "libre" | "avertir" | "refuser";

const ENVOYEES: ReadonlySet<QuoteStatus> = new Set(["sent", "viewed"]);
const ENGAGEES: ReadonlySet<QuoteStatus> = new Set([
  "accepted",
  "deposit_pending",
  "deposit_paid",
]);

export function regimeDeModification(
  quote: Pick<Quote, "status" | "depositStatus">,
): RegimeDeModification {
  if (quote.depositStatus === "paid") return "refuser";
  if (ENGAGEES.has(quote.status)) return "refuser";
  if (ENVOYEES.has(quote.status)) return "avertir";
  return "libre";
}

/** Date d'envoi lisible, ou `null` si elle manque. */
function dateLisible(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * L'avertissement montré avant d'enregistrer une soumission déjà envoyée.
 *
 * Nomme la date d'envoi : « vous l'avez envoyée » est vague, « envoyée le
 * 28 août » rappelle si le client l'a déjà eue sous les yeux.
 */
export function avertissementDeModification(
  quote: Pick<Quote, "sentAt" | "viewedAt">,
): string {
  const envoi = dateLisible(quote.sentAt);
  const debut = envoi
    ? `Cette soumission a été envoyée le ${envoi}.`
    : "Cette soumission a déjà été envoyée au client.";

  const vue = quote.viewedAt
    ? " Le client l'a déjà consultée."
    : "";

  return `${debut}${vue} Vos modifications seront visibles immédiatement par le client, au même lien.`;
}

/** Le refus opposé à une soumission acceptée ou dont le dépôt est payé. */
export function refusDeModification(
  quote: Pick<Quote, "status" | "depositStatus" | "quoteNumber">,
): string {
  const motif =
    quote.depositStatus === "paid"
      ? "le dépôt a été payé"
      : "le client l'a acceptée";

  return (
    `${quote.quoteNumber} ne peut plus être modifiée : ${motif}. ` +
    `Créez plutôt une révision — la soumission d'origine reste intacte, et le ` +
    `client garde sous les yeux ce qu'il a accepté.`
  );
}

/** Numéro de la révision suivante : SO-2026-0141 → SO-2026-0141-B, puis -C. */
export function numeroDeRevision(numero: string, existants: readonly string[] = []): string {
  const base = numero.replace(/-([B-Z])$/, "");
  for (let i = 0; i < 25; i += 1) {
    const candidat = `${base}-${String.fromCharCode(66 + i)}`;
    if (!existants.includes(candidat)) return candidat;
  }
  return `${base}-${Date.now()}`;
}
