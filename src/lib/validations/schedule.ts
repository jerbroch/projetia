import { z } from "zod";

const scheduleStatusEnum = z.enum([
  "scheduled",
  "en-route",
  "in-progress",
  "completed",
  "pending-review",
  "ready-to-invoice",
  "invoice-sent",
  "paid",
  "cancelled",
]);

export const scheduleFromQuoteSchema = z
  .object({
    quoteId: z.string().uuid("Identifiant de soumission invalide"),
    date: z.string().trim().min(1, "La date est requise"),
    startTime: z.string().trim().min(1, "L'heure de début est requise"),
    endTime: z.string().trim().min(1, "L'heure de fin est requise"),
    employeeId: z.string().trim().optional().or(z.literal("")),
    status: scheduleStatusEnum,
    internalNotes: z.string().trim().optional(),
    clientPoNumber: z.string().trim().optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["endTime"],
  });

export const scheduleJobSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Le titre est requis"),
    description: z.string().trim().optional(),
    date: z.string().trim().min(1, "La date est requise"),
    startTime: z.string().trim().min(1, "L'heure de début est requise"),
    endTime: z.string().trim().min(1, "L'heure de fin est requise"),
    status: scheduleStatusEnum,
    type: z.enum(["job", "inspection", "meeting", "maintenance"]),
    employeeIds: z.array(z.string()).default([]),
    internalNotes: z.string().trim().optional(),
    clientPoNumber: z.string().trim().optional(),
    customerId: z.string().trim().optional(),
    customerName: z.string().trim().optional(),
    customerPhone: z.string().trim().optional(),
    customerEmail: z.string().trim().optional(),
    billingAddress: z.string().trim().optional(),
    jobSiteAddress: z.string().trim().optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["endTime"],
  });

export type ScheduleFromQuoteInput = z.infer<typeof scheduleFromQuoteSchema>;
export type ScheduleJobInput = z.infer<typeof scheduleJobSchema>;
