import Link from "next/link";
import { ClipboardCheck, HardHat } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * LA BANDE COMPACTE — deux compteurs qui, à zéro, ne méritent pas deux cartes.
 *
 * « Travailleurs sur le terrain » et « Travaux à vérifier » passent le plus
 * clair du temps à zéro : deux grandes cartes vides côte à côte donnaient
 * l'impression d'un écran qui n'a rien à dire. Réunis dans une bande, ils
 * occupent la place de leur contenu.
 *
 * DÈS QU'ILS ONT DES DONNÉES, l'écran reprend ses sections détaillées :
 * cette bande ne remplace rien, elle n'apparaît qu'à vide. Voir l'appelant —
 * c'est lui qui décide, parce que lui seul sait ce que contiennent les
 * listes.
 */
export interface MoitieBande {
  libelle: string;
  valeur: number;
  vide: string;
  href: string;
}

function Moitie({ item, Icone }: { item: MoitieBande; Icone: typeof HardHat }) {
  return (
    <Link
      href={item.href}
      className="flex min-h-[44px] flex-1 items-center gap-3.5 rounded-lg px-4 py-3.5 transition-colors duration-normal hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:px-5"
    >
      <Icone className="h-7 w-7 shrink-0 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-muted-foreground">{item.libelle}</span>
        <span className="block text-2xl font-bold tabular-nums leading-tight">{item.valeur}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{item.vide}</span>
      </span>
    </Link>
  );
}

export function BandeTerrain({
  terrain,
  verifier,
}: {
  terrain: MoitieBande;
  verifier: MoitieBande;
}) {
  return (
    <Card className="flex flex-col divide-y divide-border/70 p-1 sm:flex-row sm:divide-x sm:divide-y-0">
      <Moitie item={terrain} Icone={HardHat} />
      <Moitie item={verifier} Icone={ClipboardCheck} />
    </Card>
  );
}
