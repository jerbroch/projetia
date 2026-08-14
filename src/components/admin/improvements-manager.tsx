"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createImprovementAction,
  linkFeedbackToImprovementAction,
  updateImprovementStatusAction,
} from "@/lib/actions/platform/admin";
import { IMPROVEMENT_STATUS_LABELS } from "@/lib/platform/labels";
import type { PlatformFeedback, PlatformImprovement } from "@/types/platform";
import { formatDate } from "@/lib/utils";

interface ImprovementsManagerProps {
  improvements: PlatformImprovement[];
  feedback: PlatformFeedback[];
}

export function ImprovementsManager({ improvements, feedback }: ImprovementsManagerProps) {
  const [pending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createImprovementAction(formData);
    });
  }

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      await updateImprovementStatusAction(id, status);
    });
  }

  function handleLink(improvementId: string, feedbackId: string) {
    startTransition(async () => {
      await linkFeedbackToImprovementAction(improvementId, feedbackId);
    });
  }

  const unlinkedFeedback = feedback.filter((f) => f.status === "new" || f.status === "reviewed");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nouvelle amélioration</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="space-y-3">
            <input
              name="title"
              placeholder="Titre"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
            <textarea
              name="description"
              placeholder="Description"
              className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
            />
            <input
              name="priority"
              type="number"
              defaultValue={0}
              placeholder="Priorité"
              className="w-32 rounded-md border px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={pending}>
              Créer
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {improvements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune amélioration.</p>
        ) : (
          improvements.map((imp) => (
            <Card key={imp.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{imp.title}</CardTitle>
                  {imp.description && (
                    <p className="text-sm text-muted-foreground">{imp.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(imp.createdAt)} · {imp.interestedCompanies.length} entreprise(s)
                  </p>
                </div>
                <select
                  className="rounded-md border px-2 py-1 text-sm"
                  value={imp.status}
                  disabled={pending}
                  onChange={(e) => handleStatusChange(imp.id, e.target.value)}
                >
                  {Object.entries(IMPROVEMENT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </CardHeader>
              <CardContent className="space-y-3">
                {imp.interestedCompanies.length > 0 && (
                  <p className="text-sm">
                    Entreprises intéressées :{" "}
                    {imp.interestedCompanies.map((c) => c.name).join(", ")}
                  </p>
                )}
                {unlinkedFeedback.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {unlinkedFeedback.map((f) => (
                      <Button
                        key={f.id}
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleLink(imp.id, f.id)}
                      >
                        Lier « {f.title} »
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
