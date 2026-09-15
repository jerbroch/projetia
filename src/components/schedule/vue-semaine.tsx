"use client";

import { useMemo } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import type { Employee, ScheduleEvent } from "@/types";
import { getEventDayKey } from "@/lib/calendar-utils";
import { calendarDayKey } from "@/lib/schedule-timezone";
import { getScheduleBlockAppearance } from "@/lib/schedule-utils";
import { getEmployeeFullName } from "@/lib/employee-utils";
import { cn } from "@/lib/utils";

/**
 * LA SEMAINE QUI TIENT DANS L'ÉCRAN.
 *
 * La vue semaine existait déjà, mais elle étirait la ligne de temps du jour :
 * dix-sept heures à 64 px, multipliées par sept, font 7 616 pixels. On voyait
 * donc un jour, et on défilait pour trouver les autres — ce qui revient à ne
 * pas avoir de vue semaine du tout.
 *
 * ICI L'HEURE N'EST PLUS UNE POSITION, C'EST UN TEXTE. Dès qu'on renonce à
 * placer les blocs au pixel près, les sept jours tiennent côte à côte et la
 * question « qu'est-ce que j'ai cette semaine » se répond d'un coup d'œil.
 * C'est un autre outil que la vue jour, pas une version réduite : le placement
 * fin, le glisser et le redimensionnement restent la vue jour, où ils ont un
 * sens.
 *
 * ORDINATEUR : une ligne par employé, sept colonnes de jours, et la colonne
 * des noms réduite à un avatar — ce sont les jours qui ont besoin de la
 * largeur, pas les noms.
 *
 * TÉLÉPHONE : une ligne par jour, les calls en pastilles. Un gars sur un
 * chantier veut savoir ce qu'il a cette semaine, pas manipuler des colonnes de
 * vingt pixels.
 */

export const NON_ASSIGNE = "__unassigned__";

export interface VueSemaineProps {
  jours: Date[];
  employes: Employee[];
  evenements: ScheduleEvent[];
  /** Ouvre le call. */
  onEvenementClick: (event: ScheduleEvent) => void;
  /** Crée un call : jour et employé visés, sans heure — elle se choisit après. */
  onCaseClick: (employeeId: string | null, jour: Date) => void;
}

function initiales(nom: string): string {
  return nom
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}

function heureCourte(iso: string): string {
  const d = new Date(iso);
  const m = d.getMinutes();
  return m === 0 ? format(d, "H'h'", { locale: fr }) : format(d, "H'h'mm", { locale: fr });
}

/** Une pastille de call : l'heure, puis ce que c'est. */
function Pastille({
  event,
  onClick,
  avecEmploye = false,
}: {
  event: ScheduleEvent;
  onClick: () => void;
  avecEmploye?: boolean;
}) {
  const apparence = getScheduleBlockAppearance(event.status);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${heureCourte(event.start)} – ${heureCourte(event.end)} · ${event.title}`}
      className={cn(
        "w-full rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        apparence.className,
      )}
    >
      <span className="block font-semibold tabular-nums">{heureCourte(event.start)}</span>
      <span className="block truncate">{event.title}</span>
      {avecEmploye && event.employeeNames.length > 0 && (
        <span className="block truncate opacity-80">{event.employeeNames.join(", ")}</span>
      )}
    </button>
  );
}

export function VueSemaine({
  jours,
  employes,
  evenements,
  onEvenementClick,
  onCaseClick,
}: VueSemaineProps) {
  /**
   * Les calls rangés par employé puis par jour, une seule fois.
   *
   * Un call porte PLUSIEURS employés : il apparaît donc sur la ligne de
   * chacun. C'est voulu — la question posée à cette vue est « qui fait quoi »,
   * et un call à deux hommes occupe bien les deux.
   */
  const parEmployeEtJour = useMemo(() => {
    const table = new Map<string, ScheduleEvent[]>();
    const cle = (employeId: string, jour: Date) => `${employeId}|${calendarDayKey(jour)}`;

    for (const ev of evenements) {
      const jour = jours.find((j) => getEventDayKey(ev.start) === calendarDayKey(j));
      if (!jour) continue;

      const porteurs = ev.employeeIds.length > 0 ? ev.employeeIds : [NON_ASSIGNE];
      for (const id of porteurs) {
        const k = cle(id, jour);
        const liste = table.get(k);
        if (liste) liste.push(ev);
        else table.set(k, [ev]);
      }
    }
    // Chaque case dans l'ordre horaire : une case non triée se lit comme une
    // liste au hasard.
    for (const liste of table.values()) {
      liste.sort((a, b) => a.start.localeCompare(b.start));
    }
    return table;
  }, [evenements, jours]);

  /** Les calls d'un jour, tous employés confondus — pour la vue téléphone. */
  const parJour = useMemo(() => {
    const table = new Map<string, ScheduleEvent[]>();
    for (const ev of evenements) {
      const jour = jours.find((j) => getEventDayKey(ev.start) === calendarDayKey(j));
      if (!jour) continue;
      const k = calendarDayKey(jour);
      const liste = table.get(k);
      if (liste) liste.push(ev);
      else table.set(k, [ev]);
    }
    for (const liste of table.values()) {
      liste.sort((a, b) => a.start.localeCompare(b.start));
    }
    return table;
  }, [evenements, jours]);

  const lignes = [
    ...employes.map((e) => ({
      id: e.id,
      nom: getEmployeeFullName(e),
      metier: e.trade,
      employe: e,
    })),
    { id: NON_ASSIGNE, nom: "Non assigné", metier: "", employe: null as Employee | null },
  ];

  return (
    <>
      {/* ───────── ORDINATEUR : employés en lignes, sept jours en colonnes ───────── */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-lg border">
          {/* L'en-tête des jours. Une seule bande : les noms de jours et les
              repères d'heures se chevauchaient quand ils la partageaient —
              c'est le « 5AM 13 » illisible. Ici il n'y a plus de repère
              d'heure du tout, l'heure est écrite dans la pastille. */}
          <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b bg-muted/40">
            <div className="border-r p-2" aria-hidden />
            {jours.map((jour) => (
              <div
                key={jour.toISOString()}
                className={cn(
                  "border-r p-2 text-center last:border-r-0",
                  isToday(jour) && "bg-primary/10",
                )}
              >
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {format(jour, "EEE", { locale: fr })}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    isToday(jour) ? "text-primary" : "text-foreground",
                  )}
                >
                  {format(jour, "d", { locale: fr })}
                </div>
              </div>
            ))}
          </div>

          <div className="divide-y">
            {lignes.map((ligne) => (
              <div
                key={ligne.id}
                className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] min-h-[64px]"
              >
                {/* La colonne des noms, réduite à un avatar. */}
                <div className="flex items-center justify-center border-r bg-muted/20 p-1">
                  <span
                    title={ligne.metier ? `${ligne.nom} — ${ligne.metier}` : ligne.nom}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold",
                      ligne.employe
                        ? "bg-primary/10 text-primary"
                        : "border border-dashed text-muted-foreground",
                    )}
                  >
                    {ligne.employe ? initiales(ligne.nom) : "—"}
                  </span>
                </div>

                {jours.map((jour) => {
                  const calls =
                    parEmployeEtJour.get(`${ligne.id}|${calendarDayKey(jour)}`) ?? [];
                  return (
                    /*
                      DEUX ZONES CLIQUABLES, PAS UNE DANS L'AUTRE.

                      La case entière était un `<button>` et chaque pastille en
                      était un autre : un bouton dans un bouton, que le HTML
                      interdit et que React signale comme erreur d'hydratation.
                      Le bouton « ajouter » passe donc DERRIÈRE les pastilles,
                      en fond de case — on clique une pastille pour l'ouvrir,
                      le vide pour créer.
                    */
                    <div
                      key={jour.toISOString()}
                      className={cn(
                        "relative border-r p-1 last:border-r-0",
                        isToday(jour) && "bg-primary/[0.04]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onCaseClick(ligne.employe ? ligne.id : null, jour)}
                        aria-label={`Ajouter un call — ${ligne.nom}, ${format(jour, "EEEE d MMMM", { locale: fr })}`}
                        className="absolute inset-0 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      />
                      <div className="relative space-y-1">
                        {calls.map((ev) => (
                          <Pastille
                            key={`${ev.id}-${ligne.id}`}
                            event={ev}
                            onClick={() => onEvenementClick(ev)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────── TÉLÉPHONE : une ligne par jour ───────── */}
      <div className="space-y-2 md:hidden">
        {jours.map((jour) => {
          const calls = parJour.get(calendarDayKey(jour)) ?? [];
          return (
            <section
              key={jour.toISOString()}
              className={cn(
                "rounded-lg border",
                isToday(jour) ? "border-primary/40 bg-primary/[0.04]" : "bg-card",
              )}
            >
              <header className="flex items-baseline justify-between border-b px-3 py-2">
                <h3
                  className={cn(
                    // `capitalize` mettrait une majuscule à CHAQUE mot —
                    // « Lundi 14 Septembre ». En français le mois n'en prend
                    // pas : seule la première lettre.
                    "text-sm font-semibold first-letter:uppercase",
                    isToday(jour) ? "text-primary" : "text-foreground",
                  )}
                >
                  {format(jour, "EEEE d MMMM", { locale: fr })}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {calls.length === 0
                    ? "rien de prévu"
                    : `${calls.length} call${calls.length > 1 ? "s" : ""}`}
                </span>
              </header>

              <div className="space-y-1.5 p-2">
                {calls.map((ev) => (
                  <Pastille
                    key={ev.id}
                    event={ev}
                    avecEmploye
                    onClick={() => onEvenementClick(ev)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => onCaseClick(null, jour)}
                  className="w-full rounded-md border border-dashed py-1.5 text-[11px] text-muted-foreground transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Ajouter un call
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Exporté pour les tests : la semaine est-elle vide? */
export function semaineEstVide(evenements: ScheduleEvent[], jours: Date[]): boolean {
  return !evenements.some((ev) =>
    jours.some((j) => isSameDay(new Date(ev.start), j)),
  );
}
