import { CalendarDays, FileText, HardHat, TrendingUp } from "lucide-react";
import { PlanArchitectural } from "@/components/brand/plan-architectural";

/**
 * LE VOLET GAUCHE DE LA CONNEXION — « du plan au chantier ».
 *
 * Le plan se trace, puis trois éléments de l'application s'y posent : une
 * soumission acceptée, un chantier au calendrier, une ligne de temps. C'est
 * l'histoire du produit en trois objets, pas un décor.
 *
 * LES TROIS APERÇUS SONT FIDÈLES à ce que l'application fait vraiment —
 * numéro de soumission, statut, chantier daté. Rien d'inventé : une capture
 * mensongère sur une page de connexion se paie à la première utilisation.
 *
 * Caché sous `lg` : sur un téléphone, le formulaire passe avant. Ce volet y
 * deviendrait un obstacle à faire défiler avant de pouvoir taper son
 * courriel.
 */
export function VoletPlan() {
  return (
    <section
      aria-hidden
      className="relative hidden overflow-hidden bg-[hsl(var(--plan-fond))] lg:flex lg:flex-col lg:justify-between lg:p-12"
    >
      <PlanArchitectural pas={30} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--plan-accent)/0.12)_0%,transparent_55%)]" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-[hsl(var(--plan-trait))]">
            Construction iOS
          </span>
        </div>
      </div>

      {/* Les objets de l'application, posés sur le plan. */}
      <div className="relative space-y-3">
        {/*
          L'APERÇU DU TABLEAU DE BORD — ce vers quoi on se connecte.

          Les deux autres cartes montrent des objets (une soumission, un
          chantier). Celle-ci montre l'endroit : trois chiffres du tableau de
          bord, qui disent en un coup d'œil ce que l'application sait de
          l'entreprise. Ce sont les compteurs réels de /dashboard, pas des
          valeurs flatteuses inventées pour la vitrine.
        */}
        <article
          className="plan-monter max-w-sm rounded-lg border border-[hsl(var(--plan-ligne)/0.35)] bg-[hsl(var(--plan-fond))]/80 p-4 backdrop-blur-sm"
          style={{ animationDelay: "0.9s" }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--plan-accent))]" />
            <span className="text-xs font-medium text-[hsl(var(--plan-trait))]">
              Votre tableau de bord
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            {[
              { l: "Soumissions en attente", v: "3" },
              { l: "Chantiers cette semaine", v: "5" },
              { l: "À facturer", v: "2" },
            ].map((c) => (
              <div key={c.l}>
                <dd className="text-xl font-bold tabular-nums text-[hsl(var(--plan-trait))]">
                  {c.v}
                </dd>
                <dt className="mt-0.5 text-[10px] leading-tight text-[hsl(var(--plan-trait))]/60">
                  {c.l}
                </dt>
              </div>
            ))}
          </dl>
        </article>

        <article
          className="plan-monter max-w-sm rounded-lg border border-[hsl(var(--plan-ligne)/0.35)] bg-[hsl(var(--plan-fond))]/80 p-4 backdrop-blur-sm"
          style={{ animationDelay: "1.1s" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[hsl(var(--plan-accent))]" />
              <span className="font-mono text-xs text-[hsl(var(--plan-trait))]">SO-2026-002</span>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              Acceptée
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-[hsl(var(--plan-trait))]">
            Remplacer le chauffe-eau 60 gallons
          </p>
          <div className="mt-3 h-px w-full overflow-hidden bg-[hsl(var(--plan-ligne)/0.25)]">
            <div
              className="plan-ligne-construire h-full bg-[hsl(var(--plan-accent))]"
              style={{ animationDelay: "1.5s" }}
            />
          </div>
        </article>

        <article
          className="plan-monter max-w-sm rounded-lg border border-[hsl(var(--plan-ligne)/0.35)] bg-[hsl(var(--plan-fond))]/80 p-4 backdrop-blur-sm"
          style={{ animationDelay: "1.35s" }}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[hsl(var(--plan-accent))]" />
            <span className="text-xs text-[hsl(var(--plan-trait))]">Mardi · 8 h – 12 h</span>
          </div>
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-6 flex-1 rounded-sm border border-[hsl(var(--plan-ligne)/0.3)]"
                style={
                  i === 1 || i === 2
                    ? { background: "hsl(var(--plan-accent) / 0.75)", borderColor: "transparent" }
                    : undefined
                }
              />
            ))}
          </div>
        </article>
      </div>

      <div className="relative max-w-md">
        <p className="text-2xl font-semibold leading-snug text-[hsl(var(--plan-trait))]">
          Votre entreprise. Vos chantiers.
          <br />
          <span className="text-primary">Un seul espace de travail.</span>
        </p>
      </div>
    </section>
  );
}
