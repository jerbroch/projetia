import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * À FAIRE AVANCER — ce qui attend une décision, et le geste qui la prend.
 *
 * Trois lignes seulement, chacune avec son bouton. Ce n'est pas une liste de
 * notifications : chaque entrée mène à l'écran où l'on règle la chose, en un
 * clic. Une ligne sans action serait un reproche, pas une aide.
 *
 * LES ZÉROS SE TAISENT. Une entreprise dont tout est à jour ne doit pas lire
 * trois lignes à zéro : elle doit lire que tout est à jour. Ce qui reste
 * affiché appelle donc toujours un geste.
 */

export interface ChoseAFaire {
  cle: string;
  icone: typeof FileText;
  titre: string;
  detail: string;
  action: string;
  href: string;
  nombre: number;
}

export function construireChosesAFaire(input: {
  aPlanifier: number;
  aFacturer: number;
  outilsEnRetard: number;
}): ChoseAFaire[] {
  return [
    {
      cle: "planifier",
      icone: FileText,
      titre: "Soumissions acceptées",
      detail: "Prêtes à être planifiées",
      action: "Planifier",
      href: "/quotes?statut=accepted",
      nombre: input.aPlanifier,
    },
    {
      cle: "facturer",
      icone: CheckCircle2,
      titre: "Travaux terminés",
      detail: "Prêts à être facturés",
      action: "Facturer",
      href: "/reviews",
      nombre: input.aFacturer,
    },
    {
      cle: "outils",
      icone: Wrench,
      titre: "Outils en retard",
      detail: "Chez un employé",
      action: "Voir",
      href: "/outillage",
      nombre: input.outilsEnRetard,
    },
  ].filter((c) => c.nombre > 0);
}

export function AFaireAvancer({ choses }: { choses: ChoseAFaire[] }) {
  const total = choses.reduce((n, c) => n + c.nombre, 0);

  return (
    <section
      className="rounded-2xl border border-border bg-card shadow-sm"
      aria-labelledby="titre-a-faire"
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 id="titre-a-faire" className="text-lg font-semibold text-foreground">
          À faire avancer
        </h2>
        {total > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground">
            {total}
          </span>
        )}
      </header>

      {choses.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          Rien n&apos;attend de décision. Tout est à jour.
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {choses.map(({ cle, icone: Icone, titre, detail, action, href, nombre }) => (
            <li key={cle} className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-petrole">
                <Icone className="h-[18px] w-[18px]" aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {titre}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">({nombre})</span>
                </span>
                <span className="block text-[13px] text-muted-foreground">{detail}</span>
              </span>

              {/*
                LE BOUTON EST CONTOURÉ, PAS PLEIN. Trois boutons orange pleins
                dans une même carte se disputeraient l'attention que l'orange
                sert justement à diriger ; le bouton principal de l'écran reste
                « Créer un appel ».
              */}
              <Link
                href={href}
                className={cn(
                  "flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-primary/35 px-3",
                  "text-[13px] font-semibold text-accent-encre",
                  "transition-colors duration-normal hover:bg-primary/[0.08] motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                )}
              >
                {action}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
