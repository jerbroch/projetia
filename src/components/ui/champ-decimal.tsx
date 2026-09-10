"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  decimalDepuisTexte,
  texteDecimalNettoye,
  texteDepuisDecimal,
} from "@/lib/nombre-decimal";

/**
 * UN CHAMP DE NOMBRE QUI ACCEPTE LA VIRGULE.
 *
 * `<input type="number">` refuse la virgule dans la plupart des navigateurs :
 * `e.target.value` rend une chaîne vide, `Number("")` rend 0, et une heure et
 * demie s'enregistre comme zéro sans un mot. Le champ n'échoue pas, il ment.
 *
 * D'où `type="text"` avec `inputMode="decimal"` : le téléphone ouvre bien le
 * pavé numérique à séparateur — ce que `type="number"` faisait déjà — mais
 * sans que le navigateur s'arroge le droit de vider la valeur.
 *
 * Le texte tapé est conservé tel quel pendant la frappe : « 1, » doit vivre le
 * temps que le doigt trouve le 5. Normaliser à chaque touche effacerait la
 * virgule à l'instant où on la pose.
 */
export interface ChampDecimalProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  /** Le texte affiché. Le parent reste maître de la valeur. */
  value: string;
  /** Reçoit le texte nettoyé — chiffres, un séparateur, N décimales au plus. */
  onValeurChange: (texte: string) => void;
  /** Décimales acceptées à la frappe. Deux par défaut. */
  decimales?: number;
}

export const ChampDecimal = React.forwardRef<HTMLInputElement, ChampDecimalProps>(
  ({ value, onValeurChange, decimales = 2, inputMode, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        // Le pavé décimal sur téléphone. `numeric` donnerait un pavé SANS
        // séparateur : impossible d'écrire 1,5 avec des gants sur un chantier.
        inputMode={inputMode ?? "decimal"}
        // Pour les navigateurs qui s'en servent pour choisir le clavier.
        pattern="[0-9]*[.,]?[0-9]*"
        autoComplete="off"
        value={value}
        onChange={(e) => onValeurChange(texteDecimalNettoye(e.target.value, decimales))}
        {...props}
      />
    );
  }
);
ChampDecimal.displayName = "ChampDecimal";

/**
 * LE MÊME CHAMP, POUR UN PARENT QUI TIENT UN NOMBRE.
 *
 * Quand la valeur vit en nombre — les heures d'une ligne de soumission, par
 * exemple — on ne peut pas se contenter de la reformater à chaque touche :
 * « 1, » redeviendrait « 1 » et la virgule disparaîtrait sous le doigt. Ce
 * composant garde donc un tampon de frappe, et ne le resynchronise que
 * lorsque la valeur change POUR DE VRAI ailleurs.
 */
export interface ChampDecimalNombreProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  valeur: number | null | undefined;
  onNombreChange: (n: number | null) => void;
  decimales?: number;
}

export const ChampDecimalNombre = React.forwardRef<HTMLInputElement, ChampDecimalNombreProps>(
  ({ valeur, onNombreChange, decimales = 2, ...props }, ref) => {
    const [brut, setBrut] = React.useState(() => texteDepuisDecimal(valeur, decimales));

    // Resynchronisation seulement quand la valeur externe s'écarte de ce qui
    // est affiché. Comparer les NOMBRES et non les textes : sinon « 1, » et 1
    // paraîtraient différents et le tampon serait écrasé à chaque frappe.
    React.useEffect(() => {
      if (decimalDepuisTexte(brut, decimales) !== (valeur ?? null)) {
        setBrut(texteDepuisDecimal(valeur, decimales));
      }
      // `brut` est volontairement absent : il change à chaque touche, et le
      // relire ici ramènerait l'écrasement qu'on vient d'éviter.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [valeur, decimales]);

    return (
      <ChampDecimal
        ref={ref}
        value={brut}
        decimales={decimales}
        onValeurChange={(t) => {
          setBrut(t);
          onNombreChange(decimalDepuisTexte(t, decimales));
        }}
        {...props}
      />
    );
  }
);
ChampDecimalNombre.displayName = "ChampDecimalNombre";
