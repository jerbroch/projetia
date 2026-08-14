"use client";

import { useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateImprovementStatusAction } from "@/lib/actions/platform/admin";
import { IMPROVEMENT_STATUS_LABELS, ROADMAP_COLUMNS } from "@/lib/platform/labels";
import type { PlatformImprovement } from "@/types/platform";

interface RoadmapBoardProps {
  improvements: PlatformImprovement[];
}

export function RoadmapBoard({ improvements }: RoadmapBoardProps) {
  const [pending, startTransition] = useTransition();

  function moveTo(improvementId: string, status: string) {
    startTransition(async () => {
      await updateImprovementStatusAction(improvementId, status);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {ROADMAP_COLUMNS.map((column) => {
        const items = improvements.filter((i) => i.status === column);
        return (
          <Card key={column}>
            <CardHeader>
              <CardTitle className="text-sm">{IMPROVEMENT_STATUS_LABELS[column]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Vide</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded border p-3 text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.interestedCompanies.length} entreprise(s)
                    </p>
                    <select
                      className="mt-2 w-full rounded border px-2 py-1 text-xs"
                      value={item.status}
                      disabled={pending}
                      onChange={(e) => moveTo(item.id, e.target.value)}
                    >
                      {Object.entries(IMPROVEMENT_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          → {label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
