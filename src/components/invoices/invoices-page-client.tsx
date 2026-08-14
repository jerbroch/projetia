"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { JobBillingDialog } from "@/components/billing/job-billing-dialog";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Company, Invoice, ProfileRole, ScheduleEvent, User } from "@/types";

interface InvoicesPageClientProps {
  invoices: Invoice[];
  scheduleEvents: ScheduleEvent[];
  company: Company;
  user: User;
  membershipRole: ProfileRole;
  isDemo?: boolean;
}

const clickableRowClassName =
  "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function resolveInvoiceJob(invoice: Invoice, events: ScheduleEvent[]): ScheduleEvent | undefined {
  if (invoice.scheduledJobId) {
    const byJobId = events.find((event) => event.id === invoice.scheduledJobId);
    if (byJobId) return byJobId;
  }

  if (invoice.quoteId) {
    const byQuote = events.find((event) => event.quoteId === invoice.quoteId);
    if (byQuote) return byQuote;
  }

  if (invoice.jobNumber) {
    const byJobNumber = events.find((event) => event.jobNumber === invoice.jobNumber);
    if (byJobNumber) return byJobNumber;
  }

  return undefined;
}

export function InvoicesPageClient({
  invoices,
  scheduleEvents,
  company,
  user,
  membershipRole,
  isDemo,
}: InvoicesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingEvent, setBillingEvent] = useState<ScheduleEvent | undefined>();
  const [billingError, setBillingError] = useState("");

  const eventsByInvoiceId = useMemo(() => {
    const map = new Map<string, ScheduleEvent>();
    for (const invoice of invoices) {
      const event = resolveInvoiceJob(invoice, scheduleEvents);
      if (event) map.set(invoice.id, event);
    }
    return map;
  }, [invoices, scheduleEvents]);

  const openInvoice = useCallback(
    (invoice: Invoice) => {
      const event = eventsByInvoiceId.get(invoice.id);
      if (!event) {
        setBillingError("Aucun travail associé à cette facture.");
        return;
      }
      setBillingError("");
      setBillingEvent(event);
      setBillingOpen(true);
    },
    [eventsByInvoiceId]
  );

  useEffect(() => {
    const invoiceId = searchParams.get("invoice");
    if (!invoiceId) return;

    const invoice = invoices.find((item) => item.id === invoiceId);
    if (invoice) openInvoice(invoice);
  }, [searchParams, invoices, openInvoice]);

  const totalOutstanding = invoices
    .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
    .reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);

  return (
    <DashboardLayout
      title="Factures"
      description="Facturation et suivi des paiements"
      company={company}
      user={user}
      isDemo={isDemo}
    >
      <PageHeader
        title="Factures"
        description="Gérez la facturation et suivez les paiements"
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle facture
          </Button>
        }
      />

      {billingError && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {billingError}
        </p>
      )}

      {invoices.length === 0 ? (
        <EmptyState
          title="Aucune facture"
          description="Créez votre première facture à partir d'une soumission acceptée."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Payées</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0)
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">En retard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  {invoices.filter((i) => i.status === "overdue").length}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:hidden">
            {invoices.map((invoice) => (
              <Card
                key={invoice.id}
                className={cn(eventsByInvoiceId.has(invoice.id) && clickableRowClassName)}
                role={eventsByInvoiceId.has(invoice.id) ? "button" : undefined}
                tabIndex={eventsByInvoiceId.has(invoice.id) ? 0 : undefined}
                onClick={() => openInvoice(invoice)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openInvoice(invoice);
                  }
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{invoice.invoiceNumber}</CardTitle>
                      <p className="text-sm text-muted-foreground">{invoice.customerName}</p>
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-semibold">{formatCurrency(invoice.amount)}</p>
                  <p className="text-xs text-muted-foreground">Échéance {formatDate(invoice.dueDate)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Travail</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Payé</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Échéance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className={cn(eventsByInvoiceId.has(invoice.id) && clickableRowClassName)}
                      onClick={() => openInvoice(invoice)}
                      aria-label={`Ouvrir la facture ${invoice.invoiceNumber}`}
                    >
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.jobNumber ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>{formatCurrency(invoice.paidAmount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {billingEvent && (
        <JobBillingDialog
          open={billingOpen}
          onOpenChange={setBillingOpen}
          event={billingEvent}
          company={company}
          membershipRole={membershipRole}
          isDemo={isDemo}
          archiveMode
          onBillingUpdated={() => router.refresh()}
        />
      )}
    </DashboardLayout>
  );
}
