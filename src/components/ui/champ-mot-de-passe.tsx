"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * UN CHAMP DE MOT DE PASSE QU'ON PEUT LIRE.
 *
 * Sur un téléphone, avec des gants ou sous la pluie, taper un mot de passe de
 * dix caractères à l'aveugle se solde souvent par un échec de connexion qui
 * ressemble à un oubli. Pouvoir vérifier ce qu'on a tapé règle la moitié des
 * « je n'arrive pas à me connecter ».
 *
 * LE BOUTON NE DOIT PAS GÊNER LE TROUSSEAU. Il est `type="button"` — sans
 * quoi il soumettrait le formulaire — et l'attribut `autoComplete` reste sur
 * le champ lui-même, là où iOS et Google Password Manager le lisent.
 */
export interface ChampMotDePasseProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Ce que le lecteur d'écran annonce. Le libellé du bouton s'y réfère. */
  etiquette?: string;
}

export const ChampMotDePasse = React.forwardRef<HTMLInputElement, ChampMotDePasseProps>(
  ({ className, etiquette, id, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const suffixe = etiquette ? ` (${etiquette})` : "";

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          // De la place pour le bouton, sinon le texte passe dessous.
          className={cn("pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // `aria-pressed` dit l'ÉTAT ; le libellé dit l'ACTION. Un lecteur
          // d'écran annonce alors « Afficher le mot de passe, bouton, non
          // pressé » — on sait à la fois ce que ça fait et où on en est.
          aria-pressed={visible}
          aria-label={`${visible ? "Masquer" : "Afficher"} le mot de passe${suffixe}`}
          aria-controls={id}
          // Atteignable au clavier : pas de tabIndex négatif, et la cible
          // fait 44 px de haut, le minimum confortable au doigt.
          className="absolute inset-y-0 right-0 flex h-full w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    );
  }
);
ChampMotDePasse.displayName = "ChampMotDePasse";

/**
 * LE COURRIEL CACHÉ DES FORMULAIRES DE CHANGEMENT DE MOT DE PASSE.
 *
 * iOS et Google Password Manager n'offrent d'enregistrer un nouveau mot de
 * passe que s'ils savent À QUEL COMPTE il appartient. Un formulaire qui ne
 * contient que « nouveau mot de passe » et « confirmer » ne le dit pas : le
 * gestionnaire se tait, et l'utilisateur se retrouve avec un mot de passe
 * qu'il devra retaper à la main la prochaine fois.
 *
 * Le champ est présent et lisible par eux, mais hors du flux visuel et hors
 * du parcours au clavier — il n'a rien à dire à qui voit déjà son écran.
 */
export function CourrielDuCompte({ courriel }: { courriel: string | null | undefined }) {
  if (!courriel) return null;
  return (
    <input
      type="text"
      name="username"
      autoComplete="username"
      value={courriel}
      readOnly
      tabIndex={-1}
      aria-hidden
      className="sr-only"
    />
  );
}
