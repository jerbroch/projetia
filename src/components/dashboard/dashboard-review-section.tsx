"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getJobDisplayNumber } from "@/lib/job-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ScheduleEvent } from "@/types";

interface DashboardReviewSectionProps {
  pendingJobs: ScheduleEvent[];
  billingTotals: Record<string, number>;
  showSection: boolean;
}

export function DashboardReviewSection({
  pendingJobs,
  billingTotals,
  showSection,
}: DashboardReviewSectionProps) {
  if (!showSection) return null;

  const preview = pendingJobs.slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <Link
          href="/reviews"
          className="group block flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardTitle className="flex items-center gap-2 transition-colors group-hover:text-primary">
            <ClipboardCheck className="h-5 w-5" />
            Travaux à vérifier
          </CardTitle>
          <CardDescription>
            {pendingJobs.length} appel{pendingJobs.length !== 1 ? "s" : ""} en attente de vérification
          </CardDescription>
        </Link>
        {pendingJobs.length > 0 && (
          <Button asChild variant="outline" size="sm">
            <Link href="/reviews">Voir tout ({pendingJobs.length})</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {pendingJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun travail en attente de vérification.</p>
        ) : (
          <div className="space-y-3">
            {preview.map((job) => (
              <Link
                key={job.id}
                href={`/reviews?jobId=${job.id}`}
                className="flex cursor-pointer items-start justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {getJobDisplayNumber(job)} · {job.customerName ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.jobSiteAddress ?? job.location ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(job.start)} · {job.employeeNames.join(", ") || "—"}
                    {job.clientPoNumber && ` · P.O. ${job.clientPoNumber}`}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  {billingTotals[job.id] != null && (
                    <p className="text-sm font-medium">{formatCurrency(billingTotals[job.id])}</p>
                  )}
                  <StatusBadge status={job.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
