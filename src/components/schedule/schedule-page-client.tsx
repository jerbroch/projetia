"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  cancelScheduleJobAction,
  deleteScheduleJobAction,
  saveScheduleJobAction,
} from "@/lib/actions/schedule";
import { ArchiveJobDetailDialog } from "@/components/archives/archive-job-detail-dialog";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeProfilePanel } from "@/components/employees/employee-profile-panel";
import { ResourceCalendar, type ScheduleFilters } from "@/components/schedule/resource-calendar";
import { ScheduleEventForm } from "@/components/schedule/schedule-event-form";
import { ScheduleQuickActionsDialog } from "@/components/schedule/schedule-quick-actions-dialog";
import { JobReviewDialog } from "@/components/workflow/job-review-dialog";
import { Button } from "@/components/ui/button";
import {
  getEventDurationMinutes,
  getEventDayKey,
  minutesToTimeValue,
  resizeEventEnd,
  updateEventTiming,
  type CalendarView,
} from "@/lib/calendar-utils";
import { dateFromScheduleDayKey } from "@/lib/schedule-timezone";
import { upsertDemoScheduleEvent, mergeDemoScheduleEvents } from "@/lib/demo/schedule-events";
import { buildDemoJobNumber } from "@/lib/job-utils";
import {
  mergeScheduleJobForUpdate,
  reassignEventEmployee,
  resolveScheduleInitialDate,
  splitDateTime,
  syncEventEmployeeNames,
  syncScheduleEventsFromServer,
  type MergeScheduleMode,
  type ScheduleFormDefaults,
} from "@/lib/schedule-utils";
import { JobBillingDialog } from "@/components/billing/job-billing-dialog";
import { CloseWorkDialog } from "@/components/workflow/close-work-dialog";
import type { Company, Customer, Employee, ProfileRole, ScheduleEvent, ToolListItem, User } from "@/types";

interface SchedulePageClientProps {
  initialEvents: ScheduleEvent[];
  initialCustomers: Customer[];
  initialEmployees: Employee[];
  tools: ToolListItem[];
  company: Company;
  user: User;
  membershipRole: ProfileRole;
  isDemo?: boolean;
  initialDate?: string;
  initialEventId?: string;
}

function buildScheduleJobFormData(event: ScheduleEvent, isEdit: boolean): FormData {
  const { date, time: startTime } = splitDateTime(event.start);
  const { time: endTime } = splitDateTime(event.end);
  const formData = new FormData();

  if (isEdit) formData.set("id", event.id);
  formData.set("title", event.title);
  formData.set("description", event.description ?? "");
  formData.set("date", date);
  formData.set("startTime", startTime);
  formData.set("endTime", endTime);
  formData.set("status", event.status);
  formData.set("type", event.type);
  formData.set("employeeIds", JSON.stringify(event.employeeIds ?? []));
  formData.set("internalNotes", event.internalNotes ?? "");
  formData.set("clientPoNumber", event.clientPoNumber ?? "");
  formData.set("customerId", event.customerId ?? "");
  formData.set("customerName", event.customerName ?? "");
  formData.set("customerPhone", event.customerPhone ?? "");
  formData.set("customerEmail", event.customerEmail ?? "");
  formData.set("billingAddress", event.billingAddress ?? "");
  formData.set("jobSiteAddress", event.jobSiteAddress ?? event.location ?? "");

  return formData;
}

export function SchedulePageClient({
  initialEvents,
  initialCustomers,
  initialEmployees,
  tools,
  company,
  user,
  membershipRole,
  isDemo,
  initialDate,
  initialEventId,
}: SchedulePageClientProps) {
  const router = useRouter();
  const [events, setEvents] = useState<ScheduleEvent[]>(() =>
    isDemo ? mergeDemoScheduleEvents(initialEvents) : initialEvents
  );
  const [customerList, setCustomerList] = useState<Customer[]>(initialCustomers);
  const [employeeList] = useState<Employee[]>(initialEmployees);
  const [view, setView] = useState<CalendarView>("day");
  const [currentDate, setCurrentDate] = useState(() =>
    resolveScheduleInitialDate(isDemo ? mergeDemoScheduleEvents(initialEvents) : initialEvents, {
      initialDate,
      eventId: initialEventId,
    })
  );
  const [filters, setFilters] = useState<ScheduleFilters>({
    workerId: "all",
    trade: "all",
    truck: "all",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | undefined>();
  const [formDefaults, setFormDefaults] = useState<ScheduleFormDefaults | undefined>();
  const [profileEmployee, setProfileEmployee] = useState<Employee | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [billingEvent, setBillingEvent] = useState<ScheduleEvent | undefined>();
  const [billingOpen, setBillingOpen] = useState(false);
  const [closeWorkEvent, setCloseWorkEvent] = useState<ScheduleEvent | undefined>();
  const [closeWorkOpen, setCloseWorkOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<ScheduleEvent | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [quickEvent, setQuickEvent] = useState<ScheduleEvent | undefined>();
  const [quickOpen, setQuickOpen] = useState(false);
  const [reviewEvent, setReviewEvent] = useState<ScheduleEvent | undefined>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [, startTransition] = useTransition();
  const openedInitialEventRef = useRef(false);

  function openCreateForm(defaults?: ScheduleFormDefaults) {
    setFormMode("create");
    setEditingEvent(undefined);
    setFormDefaults(defaults);
    setFormOpen(true);
  }

  function openDetail(event: ScheduleEvent) {
    setDetailEvent(event);
    setDetailOpen(true);
  }

  function openQuickActions(event: ScheduleEvent) {
    setQuickEvent(event);
    setQuickOpen(true);
  }

  function openEditForm(event: ScheduleEvent) {
    setFormMode("edit");
    setEditingEvent(event);
    setFormDefaults(undefined);
    setFormOpen(true);
  }

  function applyLocalEvent(
    event: ScheduleEvent,
    options?: { navigateToDate?: boolean; mergeMode?: MergeScheduleMode }
  ) {
    const mergeMode = options?.mergeMode ?? "apply-all";
    setEvents((prev) => {
      const exists = prev.find((item) => item.id === event.id);
      const nextEvent = exists ? mergeScheduleJobForUpdate(exists, event, mergeMode) : event;
      if (exists) return prev.map((item) => (item.id === nextEvent.id ? nextEvent : item));
      return [...prev, nextEvent];
    });
    if (options?.navigateToDate) {
      const dayKey = getEventDayKey(event.start);
      if (dayKey) setCurrentDate(dateFromScheduleDayKey(dayKey));
    }
  }

  function handleSave(event: ScheduleEvent, newCustomer?: Customer) {
    setActionError("");
    if (newCustomer) setCustomerList((prev) => [...prev, { ...newCustomer, companyId: company.id }]);

    const synced = syncEventEmployeeNames({ ...event, companyId: company.id }, employeeList);
    const isEdit = events.some((item) => item.id === synced.id);

    if (isDemo) {
      const withNumber = synced.jobNumber
        ? synced
        : {
            ...synced,
            jobNumber: buildDemoJobNumber(events, "service_call"),
            jobNumberType: "service_call" as const,
            jobOrigin: "direct" as const,
          };
      applyLocalEvent(withNumber, { navigateToDate: true });
      upsertDemoScheduleEvent(withNumber);
      return;
    }

    startTransition(async () => {
      const result = await saveScheduleJobAction(buildScheduleJobFormData(synced, isEdit));
      if (!result.success) {
        setActionError(result.error);
        return;
      }
      if ("event" in result) {
        applyLocalEvent(result.event, { navigateToDate: true, mergeMode: "apply-all" });
        router.refresh();
      }
    });
  }

  useEffect(() => {
    const incoming = isDemo ? mergeDemoScheduleEvents(initialEvents) : initialEvents;
    setEvents((prev) => syncScheduleEventsFromServer(prev, incoming));
  }, [initialEvents, isDemo]);

  useEffect(() => {
    if (!initialEventId || openedInitialEventRef.current) return;

    const target = events.find((event) => event.id === initialEventId);
    if (!target) return;

    openedInitialEventRef.current = true;
    setCurrentDate(resolveScheduleInitialDate(events, { eventId: initialEventId }));
    setQuickEvent(target);
    setQuickOpen(true);
  }, [events, initialEventId]);

  function handleCancelJob(eventId: string) {
    setActionError("");
    if (isDemo) {
      setEvents((prev) =>
        prev.map((item) => (item.id === eventId ? { ...item, status: "cancelled" as const } : item))
      );
      const event = events.find((item) => item.id === eventId);
      if (event) upsertDemoScheduleEvent({ ...event, status: "cancelled" });
      return;
    }

    startTransition(async () => {
      const result = await cancelScheduleJobAction(eventId);
      if (!result.success) {
        setActionError(result.error);
        return;
      }
      if ("event" in result) {
        applyLocalEvent(result.event);
        router.refresh();
      }
    });
  }

  function handleDelete(eventId: string) {
    setActionError("");
    if (isDemo) {
      setEvents((prev) => prev.filter((item) => item.id !== eventId));
      return;
    }

    startTransition(async () => {
      const result = await deleteScheduleJobAction(eventId);
      if (!result.success) {
        setActionError(result.error);
        return;
      }
      setEvents((prev) => prev.filter((item) => item.id !== eventId));
      router.refresh();
    });
  }

  function persistEventUpdate(updated: ScheduleEvent) {
    setActionError("");
    const previous = events.find((item) => item.id === updated.id);
    applyLocalEvent(updated, { navigateToDate: true });

    if (isDemo) {
      upsertDemoScheduleEvent(updated);
      return;
    }

    startTransition(async () => {
      const result = await saveScheduleJobAction(buildScheduleJobFormData(updated, true));
      if (!result.success) {
        setActionError(result.error);
        if (previous) applyLocalEvent(previous, { mergeMode: "apply-all" });
        return;
      }
      if ("event" in result) {
        applyLocalEvent(result.event, { navigateToDate: true, mergeMode: "apply-all" });
        router.refresh();
      }
    });
  }

  function handleSlotClick(employeeId: string | null, date: Date, startMinutes: number) {
    const endMinutes = startMinutes + 120;
    openCreateForm({
      date,
      employeeId: employeeId ?? undefined,
      startTime: minutesToTimeValue(startMinutes),
      endTime: minutesToTimeValue(endMinutes),
    });
  }

  function handleEventMove(
    event: ScheduleEvent,
    sourceEmployeeId: string | null,
    targetEmployeeId: string | null,
    startMinutes: number,
    day: Date
  ) {
    const duration = getEventDurationMinutes(event);
    let updated = updateEventTiming(event, startMinutes, startMinutes + duration, day);
    updated = reassignEventEmployee(updated, sourceEmployeeId, targetEmployeeId);
    updated = syncEventEmployeeNames(updated, employeeList);
    persistEventUpdate(updated);
  }

  function handleEventResize(event: ScheduleEvent, endMinutes: number, day: Date) {
    const updated = syncEventEmployeeNames(resizeEventEnd(event, endMinutes, day), employeeList);
    persistEventUpdate(updated);
  }

  return (
    <DashboardLayout
      title="Calendrier"
      description="Répartition des équipes et planification"
      company={company}
      user={user}
      isDemo={isDemo}
    >
      <PageHeader
        title="Calendrier de dispatch"
        description="Assignez les équipes, déplacez les travaux et gérez le dispatch quotidien"
        action={
          <Button onClick={() => openCreateForm({ date: currentDate })}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau travail
          </Button>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{actionError}</div>
      )}

      <div className="w-full max-w-full overflow-hidden">
        <ResourceCalendar
        view={view}
        onViewChange={setView}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        employees={employeeList}
        events={events}
        filters={filters}
        onFiltersChange={setFilters}
        onSlotClick={handleSlotClick}
        onEventClick={openQuickActions}
        onEventMove={handleEventMove}
        onEventResize={handleEventResize}
        onEmployeeProfile={(employee) => {
          setProfileEmployee(employee);
          setProfileOpen(true);
        }}
      />
      </div>

      <ScheduleQuickActionsDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        event={quickEvent}
        membershipRole={membershipRole}
        company={company}
        isDemo={isDemo}
        onEventUpdated={(updated) => {
          applyLocalEvent(updated, { mergeMode: "preserve-placement" });
          setQuickEvent(updated);
        }}
        onViewDetail={openDetail}
        onCloseWork={(ev) => {
          setCloseWorkEvent(ev);
          setCloseWorkOpen(true);
        }}
        onReview={(ev) => {
          setReviewEvent(ev);
          setReviewOpen(true);
        }}
        onBilling={(ev) => {
          setBillingEvent(ev);
          setBillingOpen(true);
        }}
      />

      <ArchiveJobDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        event={detailEvent}
        isDemo={isDemo}
        onEdit={(event) => {
          setDetailOpen(false);
          openEditForm(event);
        }}
        onOpenBilling={(ev) => {
          setDetailOpen(false);
          setBillingEvent(ev);
          setBillingOpen(true);
        }}
      />

      <ScheduleEventForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        event={editingEvent}
        formDefaults={formDefaults}
        customers={customerList}
        employees={employeeList}
        companyId={company.id}
        onSave={handleSave}
        onCancelJob={handleCancelJob}
        onDelete={handleDelete}
        onBilling={(ev) => {
          setBillingEvent(ev);
          setBillingOpen(true);
        }}
        onCloseWork={(ev) => {
          setCloseWorkEvent(ev);
          setCloseWorkOpen(true);
        }}
      />

      {billingEvent && (
        <JobBillingDialog
          open={billingOpen}
          onOpenChange={setBillingOpen}
          event={billingEvent}
          company={company}
          membershipRole={membershipRole}
          isDemo={isDemo}
        />
      )}

      {closeWorkEvent && (
        <CloseWorkDialog
          open={closeWorkOpen}
          onOpenChange={setCloseWorkOpen}
          event={closeWorkEvent}
          company={company}
          membershipRole={membershipRole}
          isDemo={isDemo}
          onSubmitted={(updated) => {
            applyLocalEvent(updated);
            router.refresh();
          }}
        />
      )}

      {reviewEvent && (
        <JobReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          event={reviewEvent}
          company={company}
          membershipRole={membershipRole}
          isDemo={isDemo}
          onUpdated={(updated) => {
            applyLocalEvent(updated);
            router.refresh();
          }}
        />
      )}

      <EmployeeProfilePanel
        open={profileOpen}
        onOpenChange={setProfileOpen}
        employee={profileEmployee}
        tools={tools}
        employees={employeeList}
        company={company}
        membershipRole={membershipRole}
        isDemo={isDemo}
        onEdit={() => profileEmployee && setProfileOpen(false)}
        onArchive={() => undefined}
          onRestore={() => undefined}
      />
    </DashboardLayout>
  );
}
