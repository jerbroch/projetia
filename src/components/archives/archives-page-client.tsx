"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ArchivesSearchBar } from "@/components/archives/archives-search-bar";
import { ArchiveJobDetailDialog } from "@/components/archives/archive-job-detail-dialog";
import { JobBillingDialog } from "@/components/billing/job-billing-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildArchiveSearchContext,
  filterArchivedJobs,
  getArchiveYears,
  type ArchiveFilters,
} from "@/lib/job-search";
import {
  JOB_ORIGIN_LABELS,
  getJobDisplayNumber,
  resolveJobOrigin,
} from "@/lib/job-utils";
import { formatDate } from "@/lib/utils";
import { getEmployeeFullName } from "@/lib/employee-utils";
import type { Company, Customer, Employee, ProfileRole, Quote, ScheduleEvent, User } from "@/types";

interface ArchivesPageClientProps {
  initialEvents: ScheduleEvent[];
  customers: Customer[];
  employees: Employee[];
  quotesById: Record<string, Quote>;
  company: Company;
  user: User;
  membershipRole: ProfileRole;
  isDemo?: boolean;
}

const DEFAULT_FILTERS: ArchiveFilters = {
  type: "all",
  customerId: null,
  employeeId: null,
  year: null,
  status: "all",
};

export function ArchivesPageClient({
  initialEvents,
  customers,
  employees,
  quotesById,
  company,
  user,
  membershipRole,
  isDemo,
}: ArchivesPageClientProps) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ArchiveFilters>(DEFAULT_FILTERS);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingEvent, setBillingEvent] = useState<ScheduleEvent | undefined>();

  const searchContext = useMemo(() => buildArchiveSearchContext(customers), [customers]);
  const archiveYears = useMemo(() => getArchiveYears(events), [events]);

  const filteredJobs = useMemo(
    () => filterArchivedJobs(events, searchQuery, filters, searchContext, employees),
    [events, searchQuery, filters, searchContext, employees]
  );

  const hasActiveFilters =
    filters.type !== "all" ||
    filters.customerId != null ||
    filters.employeeId != null ||
    filters.year != null ||
    filters.status !== "all" ||
    searchQuery.trim().length > 0;

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery("");
  }

  function openDetail(event: ScheduleEvent) {
    setSelectedEvent(event);
    setDetailOpen(true);
  }

  function openInvoice(event: ScheduleEvent) {
    setBillingEvent(event);
    setBillingOpen(true);
    setDetailOpen(false);
  }

  function handleRestored(updated: ScheduleEvent) {
    setEvents((prev) => prev.filter((event) => event.id !== updated.id));
    setSelectedEvent(undefined);
    router.refresh();
  }

  function handleDeleted(deletedId: string) {
    setEvents((prev) => prev.filter((event) => event.id !== deletedId));
    setSelectedEvent(undefined);
    router.refresh();
  }

  return (
    <DashboardLayout
      title="Archives"
      description="Travaux terminés et historique"
      company={company}
      user={user}
    >
      <PageHeader
        title="Archives"
        description="Consultez les contrats et bons de travail complétés ou annulés"
      />

      <ArchivesSearchBar
        events={events}
        customers={customers}
        employees={employees}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onClearSearch={() => setSearchQuery("")}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          value={filters.type}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, type: value as ArchiveFilters["type"] }))
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="contract">Contrats</SelectItem>
            <SelectItem value="service_call">BT</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.customerId ?? "all"}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, customerId: value === "all" ? null : value }))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.employeeId ?? "all"}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, employeeId: value === "all" ? null : value }))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Employé" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les employés</SelectItem>
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {getEmployeeFullName(employee)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.year != null ? String(filters.year) : "all"}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              year: value === "all" ? null : parseInt(value, 10),
            }))
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {archiveYears.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, status: value as ArchiveFilters["status"] }))
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="completed">Complété</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="outline" onClick={clearFilters}>
            Réinitialiser
          </Button>
        )}
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState
          title="Aucun travail archivé"
          description={
            hasActiveFilters
              ? "Aucun résultat ne correspond à vos filtres."
              : "Les travaux complétés ou annulés apparaîtront ici."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Employés</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>P.O.</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((event) => (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(event)}
                  >
                    <TableCell className="font-medium">{getJobDisplayNumber(event)}</TableCell>
                    <TableCell>{formatDate(event.start)}</TableCell>
                    <TableCell>{event.customerName ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {event.jobSiteAddress ?? event.location ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {event.employeeNames.join(", ") || "—"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{event.title}</TableCell>
                    <TableCell>{event.clientPoNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{JOB_ORIGIN_LABELS[resolveJobOrigin(event)]}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ArchiveJobDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        event={selectedEvent}
        quote={selectedEvent?.quoteId ? quotesById[selectedEvent.quoteId] : null}
        membershipRole={membershipRole}
        isDemo={isDemo}
        onOpenInvoice={openInvoice}
        onOpenBilling={openInvoice}
        onRestored={handleRestored}
        onDeleted={handleDeleted}
      />

      {billingEvent && (
        <JobBillingDialog
          open={billingOpen}
          onOpenChange={setBillingOpen}
          event={billingEvent}
          company={company}
          membershipRole={membershipRole}
          isDemo={isDemo}
          archiveMode
        />
      )}
    </DashboardLayout>
  );
}
