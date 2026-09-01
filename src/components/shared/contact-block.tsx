import { Mail, Phone } from "lucide-react";
import { lienCourriel, lienTelephonique, type Coordonnees } from "@/lib/coordonnees";
import { cn } from "@/lib/utils";

/**
 * Coordonnées affichées, et composables d'un toucher.
 *
 * Les deux lignes sont des liens `tel:` et `mailto:` — sur un téléphone, un
 * homme avec des gants touche le numéro, il ne le recopie pas. Quand le
 * numéro n'est pas composable, on affiche le texte SANS lien plutôt qu'un
 * lien mort : un lien qui ne fait rien coûte plus cher qu'un simple texte.
 *
 * Les cibles font au moins 44 px de haut — la taille d'un doigt, pas d'un
 * curseur.
 */
export function ContactBlock({
  coordonnees,
  titre,
  sousTitre,
  className,
  compact = false,
}: {
  coordonnees: Coordonnees;
  titre?: string;
  sousTitre?: string;
  className?: string;
  compact?: boolean;
}) {
  const tel = lienTelephonique(coordonnees.telephone);
  const mail = lienCourriel(coordonnees.email);

  const ligne = cn(
    "flex min-h-[44px] items-center gap-3 rounded-lg border px-4 transition-colors",
    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );

  return (
    <div className={cn("space-y-3", className)}>
      {titre && (
        <div>
          <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>{titre}</h3>
          {sousTitre && <p className="mt-1 text-sm text-muted-foreground">{sousTitre}</p>}
        </div>
      )}

      <div className="space-y-2">
        {coordonnees.telephone &&
          (tel ? (
            <a href={tel} className={ligne}>
              <Phone className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Téléphone</span>
                <span className="block truncate font-medium">{coordonnees.telephone}</span>
              </span>
            </a>
          ) : (
            <div className={cn(ligne, "cursor-default hover:bg-transparent")}>
              <Phone className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{coordonnees.telephone}</span>
            </div>
          ))}

        {coordonnees.email &&
          (mail ? (
            <a href={mail} className={ligne}>
              <Mail className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Courriel</span>
                <span className="block truncate font-medium">{coordonnees.email}</span>
              </span>
            </a>
          ) : (
            <div className={cn(ligne, "cursor-default hover:bg-transparent")}>
              <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{coordonnees.email}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
