"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { treatFeedbackAction } from "@/lib/actions/platform/admin";
import type { PlatformFeedback } from "@/types/platform";
import { formatDate } from "@/lib/utils";

interface FeedbackListProps {
  feedback: PlatformFeedback[];
}

export function FeedbackList({ feedback }: FeedbackListProps) {
  const [pending, startTransition] = useTransition();

  function treat(id: string) {
    startTransition(async () => {
      await treatFeedbackAction(id);
    });
  }

  if (feedback.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun commentaire.</p>;
  }

  return (
    <div className="space-y-3">
      {feedback.map((item) => (
        <div key={item.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.companyName ?? item.companyId} · {formatDate(item.createdAt)} ·{" "}
                {item.status}
              </p>
            </div>
            {item.status !== "treated" && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => treat(item.id)}>
                Marquer traité
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
