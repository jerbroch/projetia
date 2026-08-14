import { parseISO } from "date-fns";
import { ACTIVE_FIELD_STATUSES } from "@/lib/job-workflow";
import type { ScheduleEvent } from "@/types";

export interface ActiveFieldJob {
  jobId: string;
  title: string;
  customerName: string;
  address: string;
  start: string;
  end: string;
  status: ScheduleEvent["status"];
  employeeIds: string[];
  employeeNames: string[];
}

export interface ActiveFieldWorker {
  employeeId: string;
  employeeName: string;
  jobId: string;
  title: string;
  customerName: string;
  address: string;
  start: string;
  end: string;
  status: ScheduleEvent["status"];
}

const INACTIVE_FIELD_STATUSES: ScheduleEvent["status"][] = [
  "completed",
  "cancelled",
  "pending-review",
  "ready-to-invoice",
  "invoice-sent",
  "paid",
];

export function isJobActiveOnField(event: ScheduleEvent, now: Date = new Date()): boolean {
  if (INACTIVE_FIELD_STATUSES.includes(event.status)) return false;
  if (event.employeeIds.length === 0) return false;

  if (event.status === "in-progress" || event.status === "en-route") return true;

  const start = parseISO(event.start);
  const end = parseISO(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  return now >= start && now <= end && ACTIVE_FIELD_STATUSES.includes(event.status);
}

export function getActiveFieldJobs(
  events: ScheduleEvent[],
  now: Date = new Date()
): ActiveFieldJob[] {
  return events
    .filter((event) => isJobActiveOnField(event, now))
    .map((event) => ({
      jobId: event.id,
      title: event.title,
      customerName: event.customerName ?? "—",
      address: event.jobSiteAddress ?? event.location ?? "—",
      start: event.start,
      end: event.end,
      status: event.status,
      employeeIds: event.employeeIds,
      employeeNames: event.employeeNames,
    }));
}

export function getActiveFieldWorkers(
  events: ScheduleEvent[],
  now: Date = new Date()
): ActiveFieldWorker[] {
  const seen = new Set<string>();
  const workers: ActiveFieldWorker[] = [];

  for (const job of getActiveFieldJobs(events, now)) {
    job.employeeIds.forEach((employeeId, index) => {
      if (seen.has(employeeId)) return;
      seen.add(employeeId);

      workers.push({
        employeeId,
        employeeName: job.employeeNames[index] ?? employeeId,
        jobId: job.jobId,
        title: job.title,
        customerName: job.customerName,
        address: job.address,
        start: job.start,
        end: job.end,
        status: job.status,
      });
    });
  }

  return workers;
}

export function countActiveFieldWorkers(events: ScheduleEvent[], now: Date = new Date()): number {
  return getActiveFieldWorkers(events, now).length;
}
