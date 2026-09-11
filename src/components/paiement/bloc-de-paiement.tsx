import { formatCurrency } from "@/lib/utils";
import type { BlocDePaiement } from "@/lib/paiement/bloc-de-paiement";

/**
 * LE RENDU À L'ÉCRAN du bloc de paiement.
 *
 * Même contenu que le courriel — `blocDePaiement()` le produit une seule fois —
 * mais rendu avec les styles de l'application plutôt qu'en tableaux à styles
 * en ligne. Le courriel doit survivre à Outlook ; la page, non.
 *
 * Ne rend rien quand le bloc est `null` : la décision d'afficher ou pas
 * appartient au module de contenu, pas à chaque surface. C'est ce qui garantit
 * qu'aucun écran ne montre un cadre « Comment payer » vide.
 */
export function BlocDePaiementAffiche({ bloc }: { bloc: BlocDePaiement | null }) {
  if (!bloc) return null;

  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
      <p className="text-base font-semibold">{bloc.titre}</p>

      {bloc.montant != null && (
        <p className="mt-2 text-sm">
          Montant à verser :{" "}
          <strong className="tabular-nums">{formatCurrency(bloc.montant)}</strong>
        </p>
      )}

      <ol className="mt-3 space-y-3">
        {bloc.etapes.map((etape, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p>{etape.texte}</p>

              {etape.precision && (
                // Le contenu sépare les lignes par un saut ; on ne le rend pas
                // en HTML dans le module commun, qui doit rester lisible par
                // les deux rendus.
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  {etape.precision.split("\n").map((ligne, j) => {
                    const [etiquette, ...valeur] = ligne.split(" : ");
                    return (
                      <p key={j}>
                        {valeur.length ? (
                          <>
                            {etiquette} : <strong className="text-foreground">{valeur.join(" : ")}</strong>
                          </>
                        ) : (
                          ligne
                        )}
                      </p>
                    );
                  })}
                </div>
              )}

              {etape.reference && (
                <>
                  <div className="mt-2 rounded-md border-2 border-dashed border-blue-600 bg-background px-3 py-2 text-center">
                    <span className="font-mono text-lg font-bold tracking-wide text-blue-700 dark:text-blue-300">
                      {etape.reference}
                    </span>
                  </div>
                  {etape.referenceNote && (
                    <p className="mt-1 text-xs text-muted-foreground">{etape.referenceNote}</p>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      {bloc.instructions && (
        <p className="mt-3 whitespace-pre-wrap border-t border-blue-200 pt-3 text-sm text-muted-foreground dark:border-blue-900">
          {bloc.instructions}
        </p>
      )}
    </div>
  );
}
