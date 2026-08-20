"use client";

import { ToolStatusBadge } from "@/components/outillage/tool-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import type { ToolListItem } from "@/types";

interface FieldToolsPageClientProps {
  tools: ToolListItem[];
}

export function FieldToolsPageClient({ tools }: FieldToolsPageClientProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mes outils</h1>
        <p className="text-sm text-muted-foreground">Outils actuellement assignés à vous</p>
      </div>

      {tools.length === 0 ? (
        <EmptyState title="Aucun outil" description="Vous n'avez aucun outil assigné pour le moment." />
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => (
            <Card key={tool.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{tool.name}</h3>
                    {tool.internalNumber && (
                      <p className="text-sm text-muted-foreground">#{tool.internalNumber}</p>
                    )}
                  </div>
                  <ToolStatusBadge status={tool.effectiveStatus} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Retour prévu : {tool.expectedReturnDate ?? "—"}
                </p>
                {tool.daysOverdue != null && tool.daysOverdue > 0 && (
                  <p className="mt-2 text-sm font-medium text-destructive">
                    En retard de {tool.daysOverdue} jour{tool.daysOverdue > 1 ? "s" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
