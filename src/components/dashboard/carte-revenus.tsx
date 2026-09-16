import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { MotifArchitectural } from "@/components/brand/motif-architectural";

/**
 * LA CARTE DES REVENUS — la seule en bleu pétrole de la rangée.
 *
 * Elle porte le chiffre qui compte le plus, et c'est la couleur qui le dit :
 * dans une rangée de cartes blanches, une carte sombre attire l'œil avant
 * qu'on ait lu quoi que ce soit. Le dessin architectural l'habite en très
 * léger, du côté opposé au montant pour ne jamais passer dessous.
 *
 * Le montant vient des données réelles — `formatCurrency` en amont — et rien
 * ici n'est écrit en dur.
 */
export function CarteRevenus({ montant, href = "/invoices" }: { montant: string; href?: string }) {
  return (
    <Link
      href={href}
      className="group relative block h-full overflow-hidden rounded-xl bg-petrole p-5 text-petrole-foreground shadow-carte transition-shadow duration-normal hover:shadow-relief focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
    >
      <MotifArchitectural
        className="pointer-events-none absolute -right-2 bottom-0 h-full w-[58%] text-petrole-foreground opacity-[0.14]"
      />
      <div className="relative flex items-center gap-2.5">
        <BarChart3 className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden />
        <span className="text-sm font-medium opacity-90">Revenus totaux</span>
      </div>
      <p className="relative mt-3 text-3xl font-bold tabular-nums tracking-tight">{montant}</p>
    </Link>
  );
}
