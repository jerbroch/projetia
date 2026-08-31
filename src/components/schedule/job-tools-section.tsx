"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { AssignToolDialog } from "@/components/outillage/assign-tool-dialog";
import { Button } from "@/components/ui/button";
import type { Employee, ToolListItem, ToolWithDetails } from "@/types";

interface JobToolsSectionProps {
  jobId: string;
  employeeIds: string[];
  employees: Employee[];
  tools: ToolListItem[];
  onAssigned?: () => void;
}

/**
 * Outils sortis pour un call.
 *
 * L'assignation reste attribuée à un EMPLOYÉ — c'est lui qui a l'outil dans
 * son camion et qui le rapporte. Le call n'est qu'une information de plus,
 * qui répond à « où est cet outil et pour quel chantier ».
 *
 * Conséquence assumée : déplacer ou annuler le chantier ne rend pas l'outil.
 * Il reste sorti tant que quelqu'un ne le retourne pas au magasin.
 */
export function JobToolsSection({
  jobId,
  employeeIds,
  employees,
  tools,
  onAssigned,
}: JobToolsSectionProps) {
  const [ouvert, setOuvert] = useState(false);
  const [outilChoisi, setOutilChoisi] = useState<ToolListItem | undefined>();

  const sortisPourCeCall = tools.filter((t) => t.currentScheduledJobId === jobId);
  const disponibles = tools.filter((t) => t.effectiveStatus === "available");

  const nomDe = (employeeId?: string | null) => {
    const e = employees.find((x) => x.id === employeeId);
    return e ? `${e.firstName} ${e.lastName}` : "—";
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" /> Outils sur ce call
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={disponibles.length === 0}
          onClick={() => {
            setOutilChoisi(disponibles[0]);
            setOuvert(true);
          }}
        >
          Assigner un outil
        </Button>
      </div>

      {sortisPourCeCall.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {disponibles.length === 0
            ? "Aucun outil disponible au magasin."
            : "Aucun outil sorti pour ce chantier."}
        </p>
      ) : (
        <ul className="space-y-1">
          {sortisPourCeCall.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{t.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                chez {nomDe(t.currentEmployeeId)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <AssignToolDialog
        open={ouvert}
        onOpenChange={setOuvert}
        tool={outilChoisi}
        employees={employees.filter((e) => employeeIds.includes(e.id))}
        defaultEmployeeId={employeeIds[0]}
        scheduledJobId={jobId}
        onAssigned={(_tool: ToolWithDetails) => {
          setOuvert(false);
          onAssigned?.();
        }}
      />
    </div>
  );
}
