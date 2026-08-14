"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { JobReviewDialog } from "@/components/workflow/job-review-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { filterPendingReviewJobs } from "@/lib/job-workflow";
import { getJobDisplayNumber } from "@/lib/job-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Company, ProfileRole, ScheduleEvent } from "@/types";

interface ReviewsPageClientProps {
  events: ScheduleEvent[];
  billingTotals: Record<string, number>;
  company: Company;
  membershipRole: ProfileRole;
  isDemo?: boolean;
  initialJobId?: string;
}

export function ReviewsPageClient({
  events,
  billingTotals,
  company,
  membershipRole,
  isDemo,
  initialJobId,
}: ReviewsPageClientProps) {
  const [localEvents, setLocalEvents] = useState(events);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | undefined>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const openedInitialJobRef = useRef(false);

  const pendingJobs = useMemo(() => filterPendingReviewJobs(localEvents), [localEvents]);

  function openReview(event: ScheduleEvent) {
    setSelectedEvent(event);
    setReviewOpen(true);
  }

  useEffect(() => {
    if (!initialJobId || openedInitialJobRef.current) return;

    const target = localEvents.find((event) => event.id === initialJobId);
    if (!target) return;

    openedInitialJobRef.current = true;
    openReview(target);
  }, [initialJobId, localEvents]);

  function handleUpdated(updated: ScheduleEvent) {
    setLocalEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelectedEvent(updated);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Travaux à vérifier
          </CardTitle>
          <CardDescription>
            {pendingJobs.length} appel{pendingJobs.length !== 1 ? "s" : ""} en attente d&apos;approbation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun travail en attente de vérification.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CON/BT</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>P.O.</TableHead>
                  <TableHead>Employés</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{getJobDisplayNumber(job)}</TableCell>
                    <TableCell>{job.customerName ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {job.jobSiteAddress ?? job.location ?? "—"}
                    </TableCell>
                    <TableCell>{job.clientPoNumber ?? "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {job.employeeNames.join(", ") || "—"}
                    </TableCell>
                    <TableCell>{formatDate(job.start)}</TableCell>
                    <TableCell>
                      {billingTotals[job.id] != null
                        ? formatCurrency(billingTotals[job.id])
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openReview(job)}>
                        Vérifier
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Button variant="link" asChild className="px-0">
        <Link href="/dashboard">← Retour au tableau de bord</Link>
      </Button>

      {selectedEvent && (
        <JobReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          event={selectedEvent}
          company={company}
          membershipRole={membershipRole}
          isDemo={isDemo}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
