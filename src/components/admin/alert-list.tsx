"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { markAlertReadAction, markAllAlertsReadAction } from "@/lib/actions/platform/admin";
import { ALERT_TYPE_LABELS } from "@/lib/platform/labels";
import type { AdminAlert } from "@/types/platform";
import { formatDate } from "@/lib/utils";

interface AlertListProps {
  alerts: AdminAlert[];
}

export function AlertList({ alerts }: AlertListProps) {
  const [pending, startTransition] = useTransition();

  function markRead(id: string) {
    startTransition(async () => {
      await markAlertReadAction(id);
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await markAllAlertsReadAction();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={pending} onClick={markAllRead}>
          Tout marquer comme lu
        </Button>
      </div>
      <div className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune alerte.</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start justify-between gap-4 rounded-lg border p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {ALERT_TYPE_LABELS[alert.alertType]}
                  </span>
                  {!alert.readAt && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      Non lu
                    </span>
                  )}
                </div>
                <p className="font-medium">{alert.title}</p>
                {alert.description && (
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(alert.createdAt)}
                  {alert.companyName && ` · ${alert.companyName}`}
                </p>
                {alert.companyId && (
                  <Link
                    href={`/admin/companies/${alert.companyId}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Voir l&apos;entreprise
                  </Link>
                )}
              </div>
              {!alert.readAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => markRead(alert.id)}
                >
                  Marquer lu
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
