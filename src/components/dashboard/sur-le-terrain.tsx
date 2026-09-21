import Link from "next/link";
import { ArrowRight, ChevronRight, MapPin } from "lucide-react";
import { buildScheduleEventLink } from "@/lib/schedule-utils";
import { initialesDe } from "@/lib/tableau-de-bord-journee";
import { cn } from "@/lib/utils";
import type { ActiveFieldWorker } from "@/lib/field-workers";

/**
 * ÉQUIPE SUR LE TERRAIN — qui est dehors, et où.
 *
 * Le panneau étroit de la référence, à droite des travaux du jour : une
 * personne par ligne, la pastille d'état sur l'avatar, le lieu à droite.
 * C'est la question qu'on pose au téléphone vingt fois par jour —
 * « Marc est où, là ? »
 *
 * LA PASTILLE DE COULEUR DIT L'ÉTAT, ET LE TEXTE LE RÉPÈTE. Sur un écran au
 * soleil la couleur seule ne passe pas, et un daltonien lit le texte.
 *
 * AUCUNE LOCALISATION N'EST INVENTÉE. Le lieu affiché est la municipalité
 * tirée de l'adresse du chantier ; quand l'adresse manque, la ligne ne porte
 * pas de lieu du tout. Il n'y a ici ni position GPS, ni présence en ligne,
 * ni fil d'activité : l'application ne les collecte pas.
 */

const ETAT: Record<string, { teinte: string; texte: string; mot: string }> = {
  "in-progress": { teinte: "bg-succes", texte: "text-succes", mot: "Sur le terrain" },
  "en-route": { teinte: "bg-info", texte: "text-info", mot: "En route" },
  scheduled: { teinte: "bg-neutre", texte: "text-muted-foreground", mot: "Planifié" },
};

/** La municipalité, pas l'adresse complète : c'est ce que la colonne peut tenir. */
function villeDe(adresse: string | undefined | null): string | null {
  const brut = adresse?.trim();
  if (!brut) return null;
  const parts = brut.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : brut;
}

function Avatar({ nom, teinte }: { nom: string; teinte: string }) {
  return (
    <span className="relative shrink-0">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-petrole">
        {initialesDe(nom)}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
          teinte,
        )}
      />
    </span>
  );
}

interface SurLeTerrainProps {
  travailleurs: ActiveFieldWorker[];
  /** Ceux qui n'ont aucun call actif — disponibles pour un appel. */
  disponibles: { id: string; nom: string }[];
  className?: string;
}

export function SurLeTerrain({ travailleurs, disponibles, className }: SurLeTerrainProps) {
  const rien = travailleurs.length === 0 && disponibles.length === 0;

  return (
    <section
      className={cn("flex flex-col rounded-xl border border-border bg-card shadow-carte", className)}
      aria-labelledby="titre-sur-le-terrain"
    >
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
        <h2 id="titre-sur-le-terrain" className="text-base font-bold text-foreground sm:text-[1.0625rem]">
          Équipe sur le terrain
        </h2>
        <Link
          href="/employees"
          className="flex shrink-0 items-center gap-1 rounded-md text-[13px] font-semibold text-accent-encre transition-colors duration-normal hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          Voir tout
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      {rien ? (
        <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-5">
          Personne n&apos;est sur le terrain en ce moment.
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {travailleurs.map((t) => {
            const etat = ETAT[t.status] ?? ETAT.scheduled;
            const ville = villeDe(t.address);
            return (
              <li key={`${t.employeeId}-${t.jobId}`}>
                <Link
                  href={buildScheduleEventLink({ id: t.jobId, start: t.start })}
                  className={cn(
                    "flex min-h-[60px] items-center gap-3 px-4 py-2.5 sm:px-5",
                    "transition-colors duration-normal hover:bg-secondary/40 motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  )}
                >
                  <Avatar nom={t.employeeName} teinte={etat.teinte} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-semibold text-foreground">
                      {t.employeeName}
                    </span>
                    <span className={cn("block truncate text-[13px] font-medium", etat.texte)}>
                      {etat.mot}
                    </span>
                  </span>
                  {ville && (
                    <span className="hidden shrink-0 items-center gap-1 text-[12px] text-muted-foreground sm:flex">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="max-w-[7rem] truncate">{ville}</span>
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                </Link>
              </li>
            );
          })}

          {disponibles.map((d) => (
            <li key={d.id} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 sm:px-5">
              <Avatar nom={d.nom} teinte="bg-neutre" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold text-foreground">
                  {d.nom}
                </span>
                <span className="block truncate text-[13px] font-medium text-muted-foreground">
                  Disponible
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
