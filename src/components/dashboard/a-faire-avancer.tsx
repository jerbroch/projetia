import Link from "next/link";
import { ChevronRight, CircleDollarSign, FileText, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * À FAIRE EN PRIORITÉ — la bande compacte, juste sous les compteurs.
 *
 * La référence la place AVANT les travaux du jour, et elle a raison : un
 * entrepreneur qui ouvre cet écran à 6 h 30 doit voir ce qui l'attend avant
 * de lire l'horaire qu'il connaît déjà.
 *
 * LES ZÉROS SE TAISENT, et la section entière disparaît quand il n'y a rien.
 * Une bande « 0 soumission à suivre » est une alerte fictive : elle apprend
 * à ignorer la zone, et le jour où elle porte un vrai chiffre, personne ne
 * la regarde plus.
 */

export interface ChoseAFaire {
  cle: string;
  icone: typeof FileText;
  /** Le chiffre, mis en avant en orange. */
  nombre: number;
  /** La suite de la phrase, déjà accordée au nombre. */
  phrase: string;
  href: string;
}

const accord = (n: number, singulier: string, pluriel: string) =>
  n > 1 ? pluriel : singulier;

export function construireChosesAFaire(input: {
  aPlanifier: number;
  aFacturer: number;
  outilsEnRetard: number;
}): ChoseAFaire[] {
  return [
    {
      cle: "planifier",
      icone: FileText,
      nombre: input.aPlanifier,
      phrase: `${accord(input.aPlanifier, "soumission attend", "soumissions attendent")} votre suivi`,
      // La vue arrive déjà filtrée sur les soumissions acceptées.
      href: "/quotes?statut=accepted",
    },
    {
      cle: "facturer",
      icone: CircleDollarSign,
      nombre: input.aFacturer,
      phrase: `${accord(input.aFacturer, "travail prêt", "travaux prêts")} à facturer`,
      href: "/reviews",
    },
    {
      cle: "outils",
      icone: Wrench,
      nombre: input.outilsEnRetard,
      phrase: `${accord(input.outilsEnRetard, "outil en retard", "outils en retard")}`,
      href: "/outillage",
    },
  ].filter((c) => c.nombre > 0);
}

export function AFaireAvancer({ choses }: { choses: ChoseAFaire[] }) {
  // Rien à traiter : on n'occupe pas l'écran pour le dire.
  if (choses.length === 0) return null;

  return (
    <section
      aria-labelledby="titre-a-faire"
      className="rounded-xl border border-border bg-card px-4 py-4 shadow-carte sm:px-5"
    >
      <h2
        id="titre-a-faire"
        className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        À faire en priorité
      </h2>

      <ul
        className={cn(
          "mt-3 grid gap-3",
          choses.length > 1 && "sm:grid-cols-2",
          choses.length > 2 && "xl:grid-cols-3",
        )}
      >
        {choses.map(({ cle, icone: Icone, nombre, phrase, href }) => (
          <li key={cle} className="flex">
            <Link
              href={href}
              className={cn(
                "flex w-full min-h-[56px] items-center gap-3 rounded-[10px] border border-border bg-background px-3 py-2.5",
                "transition-colors duration-normal hover:border-primary/40 hover:bg-secondary/50 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-petrole">
                <Icone className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-foreground">
                <span className="font-extrabold tabular-nums text-accent-encre">{nombre}</span>{" "}
                {phrase}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
