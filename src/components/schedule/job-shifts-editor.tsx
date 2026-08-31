"use client";

import { useState, useTransition } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteJobShiftAction, saveJobShiftAction } from "@/lib/actions/job-shifts";
import { isoToLocalDateTime, localDateTimeToISO } from "@/lib/schedule-timezone";
import { plageDeLEmploye, type JobShift } from "@/lib/job-shifts";

interface JobShiftsEditorProps {
  jobId: string;
  callStart: string;
  callEnd: string;
  employeeIds: string[];
  employeeNames: string[];
  shifts: JobShift[];
  onChanged?: () => void;
}

/**
 * Saisie des plages horaires par employé, en deux champs De / À.
 *
 * C'est la voie tactile : sur un téléphone, le calendrier défile
 * horizontalement, et tirer un rectangle au doigt entre en conflit direct avec
 * ce défilement. Deux champs d'heure sont sans ambiguïté sur tous les
 * appareils, et restent la seule voie possible pour qui ne dispose pas d'une
 * souris.
 *
 * « Remettre » efface la plage : l'employé revient aux heures du call, ce qui
 * est le comportement par défaut et non une absence d'horaire.
 */
export function JobShiftsEditor({
  jobId,
  callStart,
  callEnd,
  employeeIds,
  employeeNames,
  shifts,
  onChanged,
}: JobShiftsEditorProps) {
  const [erreur, setErreur] = useState("");
  const [enCours, startTransition] = useTransition();

  const { date: callDate } = isoToLocalDateTime(callStart);

  const [brouillon, setBrouillon] = useState<Record<string, { de: string; a: string }>>(() => {
    const initial: Record<string, { de: string; a: string }> = {};
    for (const id of employeeIds) {
      const p = plageDeLEmploye(id, shifts, callStart, callEnd);
      initial[id] = {
        de: isoToLocalDateTime(p.start).time,
        a: isoToLocalDateTime(p.end).time,
      };
    }
    return initial;
  });

  function enregistrer(employeeId: string) {
    const b = brouillon[employeeId];
    if (!b) return;
    setErreur("");
    startTransition(async () => {
      // localDateTimeToISO interprète l'heure dans le fuseau du Québec, comme
      // isoToLocalDateTime la relit. Passer par `new Date("...T08:00")`
      // l'interpréterait dans le fuseau du NAVIGATEUR : un employeur en
      // déplacement décalerait toutes les plages qu'il saisit.
      const debut = localDateTimeToISO(callDate, b.de);
      const fin = localDateTimeToISO(callDate, b.a);
      const r = await saveJobShiftAction(jobId, employeeId, debut, fin);
      if (!r.success) {
        setErreur(r.error ?? "Impossible d'enregistrer la plage.");
        return;
      }
      onChanged?.();
    });
  }

  function remettre(employeeId: string) {
    setErreur("");
    startTransition(async () => {
      const r = await deleteJobShiftAction(jobId, employeeId);
      if (!r.success) {
        setErreur(r.error ?? "Impossible de retirer la plage.");
        return;
      }
      setBrouillon((p) => ({
        ...p,
        [employeeId]: {
          de: isoToLocalDateTime(callStart).time,
          a: isoToLocalDateTime(callEnd).time,
        },
      }));
      onChanged?.();
    });
  }

  if (employeeIds.length === 0) return null;

  return (
    <div className="rounded-lg border p-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Plages par employé
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Sans plage, un employé suit les heures du call.
      </p>

      <div className="space-y-2">
        {employeeIds.map((id, i) => {
          const p = plageDeLEmploye(id, shifts, callStart, callEnd);
          const b = brouillon[id] ?? { de: "", a: "" };
          return (
            <div key={id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[7rem] flex-1 text-sm font-medium">
                {employeeNames[i] ?? "Employé"}
              </span>
              <Input
                type="time"
                aria-label={`Début — ${employeeNames[i] ?? "employé"}`}
                value={b.de}
                disabled={enCours}
                className="w-[7.5rem]"
                onChange={(e) =>
                  setBrouillon((prev) => ({ ...prev, [id]: { ...b, de: e.target.value } }))
                }
              />
              <Input
                type="time"
                aria-label={`Fin — ${employeeNames[i] ?? "employé"}`}
                value={b.a}
                disabled={enCours}
                className="w-[7.5rem]"
                onChange={(e) =>
                  setBrouillon((prev) => ({ ...prev, [id]: { ...b, a: e.target.value } }))
                }
              />
              <Button size="sm" disabled={enCours} onClick={() => enregistrer(id)}>
                Enregistrer
              </Button>
              {!p.heriteeDuCall && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={enCours}
                  title="Revenir aux heures du call"
                  onClick={() => remettre(id)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {erreur && <p className="mt-2 text-sm text-destructive">{erreur}</p>}
    </div>
  );
}
