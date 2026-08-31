"use client";

import { Wrench } from "lucide-react";
import { getEmployeeFullName } from "@/lib/employee-utils";
import { normalizeEmployeeToolSummary } from "@/lib/tool-utils";
import { ToolStatusBadge } from "@/components/outillage/tool-status-badge";
import type { Employee, EmployeeToolSummary } from "@/types";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface EmployeeToolsSectionProps {
  summary: EmployeeToolSummary;
  employee: Employee;
  canManage: boolean;
  onAssign?: () => void;
}

export function EmployeeToolsSection({
  summary,
  employee,
  canManage,
  onAssign,
}: EmployeeToolsSectionProps) {
  const safeSummary = normalizeEmployeeToolSummary(summary);

  const hasAny =
    safeSummary.current.length > 0 ||
    safeSummary.reservations.length > 0 ||
    safeSummary.history.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">Outillage</h4>
        </div>
        {canManage && onAssign && (
          <Button size="sm" variant="outline" onClick={onAssign}>
            Assigner un outil
          </Button>
        )}
      </div>

      {!hasAny ? (
        <p className="text-sm text-muted-foreground">
          Aucun outil assigné à {getEmployeeFullName(employee)}.
        </p>
      ) : (
        <div className="space-y-4 text-sm">
          {safeSummary.current.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-muted-foreground">En cours</p>
              <ul className="space-y-2">
                {safeSummary.current.map((tool) => (
                  <li key={tool.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{tool.name}</p>
                      <p className="text-muted-foreground">
                        Retour prévu : {formatDate(tool.expectedReturnDate)}
                      </p>
                    </div>
                    <ToolStatusBadge status={tool.effectiveStatus} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {safeSummary.reservations.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-muted-foreground">Réservations</p>
              <ul className="space-y-2">
                {safeSummary.reservations.map((tool) => (
                  <li key={`${tool.id}-${tool.startDate}`} className="rounded-lg border p-3">
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-muted-foreground">
                      Du {formatDate(tool.startDate)} au {formatDate(tool.expectedReturnDate)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {safeSummary.history.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-muted-foreground">Historique</p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-muted-foreground">
                {safeSummary.history.slice(0, 5).map((h) => (
                  <li key={h.id}>
                    {h.toolName} ({h.internalNumber}) — retour le{" "}
                    {h.actualReturnDate ? formatDate(h.actualReturnDate) : "—"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
