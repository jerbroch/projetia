"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { AssignToolDialog } from "@/components/outillage/assign-tool-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [outilId, setOutilId] = useState("");

  const sortisPourCeCall = tools.filter((t) => t.currentScheduledJobId === jobId);
  const disponibles = tools.filter((t) => t.effectiveStatus === "available");

  const outilChoisi = tools.find((t) => t.id === outilId);

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
            // On ouvre d'abord le CHOIX de l'outil. Sans cette étape, la
            // fenêtre s'ouvrait sur le premier outil libre sans jamais laisser
            // décider lequel sortait du magasin.
            setOutilId("");
            setChoixOuvert(true);
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

      <Dialog open={choixOuvert} onOpenChange={setChoixOuvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quel outil sort pour ce chantier&nbsp;?</DialogTitle>
            <DialogDescription>
              {disponibles.length} outil{disponibles.length > 1 ? "s" : ""} disponible
              {disponibles.length > 1 ? "s" : ""} au magasin.
            </DialogDescription>
          </DialogHeader>
          <Select value={outilId} onValueChange={setOutilId}>
            <SelectTrigger aria-label="Outil à assigner">
              <SelectValue placeholder="Sélectionner un outil" />
            </SelectTrigger>
            <SelectContent>
              {disponibles.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.internalNumber ? ` (${t.internalNumber})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChoixOuvert(false)}>
              Annuler
            </Button>
            <Button
              disabled={!outilId}
              onClick={() => {
                setChoixOuvert(false);
                setOuvert(true);
              }}
            >
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
