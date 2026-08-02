"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeProfilePanel } from "@/components/employees/employee-profile-panel";
import { ResourceCalendar, type ScheduleFilters } from "@/components/schedule/resource-calendar";
import { ScheduleEventForm } from "@/components/schedule/schedule-event-form";
import { Button } from "@/components/ui/button";
import {
  getEventDurationMinutes,
  minutesToTimeValue,
  resizeEventEnd,
  updateEventTiming,
  type CalendarView,
} from "@/lib/calendar-utils";
import {
  reassignEventEmployee,
  syncEventEmployeeNames,
  type ScheduleFormDefaults,
} from "@/lib/schedule-utils";
import { customers as initialCustomers, employees as initialEmployees, scheduleEvents as initialEvents } from "@/lib/mock-data";
import type { Customer, Employee, ScheduleEvent } from "@/types";

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>(initialEvents);
  const [customerList, setCustomerList] = useState<Customer[]>(initialCustomers);
  const [employeeList] = useState<Employee[]>(initialEmployees);
  const [view, setView] = useState<CalendarView>("day");
  const [currentDate, setCurrentDate] = useState(new Date(2025, 1, 12));
  const [filters, setFilters] = useState<ScheduleFilters>({
    workerId: "all",
    trade: "all",
    truck: "all",
    jobStatus: "all",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | undefined>();
  const [formDefaults, setFormDefaults] = useState<ScheduleFormDefaults | undefined>();
  const [profileEmployee, setProfileEmployee] = useState<Employee | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);

  function openCreateForm(defaults?: ScheduleFormDefaults) {
    setFormMode("create");
    setEditingEvent(undefined);
    setFormDefaults(defaults);
    setFormOpen(true);
  }

  function openEditForm(event: ScheduleEvent) {
    setFormMode("edit");
    setEditingEvent(event);
    setFormDefaults(undefined);
    setFormOpen(true);
  }

  function handleSave(event: ScheduleEvent, newCustomer?: Customer) {
    if (newCustomer) setCustomerList((prev) => [...prev, newCustomer]);

    const synced = syncEventEmployeeNames(event, employeeList);
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === synced.id);
      if (exists) return prev.map((e) => (e.id === synced.id ? synced : e));
      return [...prev, synced];
    });
    setCurrentDate(new Date(synced.start));
  }

  function handleCancelJob(eventId: string) {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: "cancelled" as const } : e))
    );
  }

  function handleDelete(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
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
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  function handleEventResize(event: ScheduleEvent, endMinutes: number, day: Date) {
    const updated = syncEventEmployeeNames(resizeEventEnd(event, endMinutes, day), employeeList);
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  return (
    <DashboardLayout title="Schedule" description="Employee dispatch and job scheduling">
      <PageHeader
        title="Dispatch Schedule"
        description="Assign crews, drag jobs between workers, and manage daily dispatch"
        action={
          <Button onClick={() => openCreateForm({ date: currentDate })}>
            <Plus className="mr-2 h-4 w-4" />
            New Job
          </Button>
        }
      />

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
        onEventEdit={openEditForm}
        onEventMove={handleEventMove}
        onEventResize={handleEventResize}
        onEmployeeProfile={(employee) => {
          setProfileEmployee(employee);
          setProfileOpen(true);
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
        onSave={handleSave}
        onCancelJob={handleCancelJob}
        onDelete={handleDelete}
      />

      <EmployeeProfilePanel
        open={profileOpen}
        onOpenChange={setProfileOpen}
        employee={profileEmployee}
        onEdit={() => profileEmployee && setProfileOpen(false)}
        onDeactivate={() => profileEmployee && setProfileOpen(false)}
      />
    </DashboardLayout>
  );
}
