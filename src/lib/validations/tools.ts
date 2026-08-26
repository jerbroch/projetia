import { z } from "zod";
import { TOOL_CATEGORIES } from "@/lib/tool-utils";

export const toolFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  category: z.string().trim().min(1, "La catégorie est requise"),
  customCategory: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  internalNumber: z.string().trim().optional(),
  description: z.string().trim().optional(),
  condition: z.enum(["good", "damaged", "needs_repair", "missing_part", "other"]).default("good"),
  baseStatus: z.enum(["available", "in_repair", "out_of_service"]).default("available"),
});

export const toolAssignSchema = z.object({
  employeeId: z.string().trim().min(1, "L'employé est requis"),
  startDate: z.string().trim().min(1, "La date de début est requise"),
  durationDays: z.coerce.number().int().min(1, "La durée doit être d'au moins 1 jour"),
  expectedReturnDate: z.string().trim().min(1, "La date de retour est requise"),
  notes: z.string().trim().optional(),
  mode: z.enum(["assign", "reserve"]).default("assign"),
});

export const toolReturnSchema = z.object({
  actualReturnDate: z.string().trim().min(1, "La date de retour est requise"),
  returnCondition: z.enum(["good", "damaged", "needs_repair", "missing_part", "other"]),
  setInRepair: z.coerce.boolean().optional(),
  notes: z.string().trim().optional(),
});

export const toolSmsSchema = z.object({
  message: z.string().trim().min(1, "Le message est requis").max(1600, "Message trop long"),
});

export type ToolFormInput = z.infer<typeof toolFormSchema>;
export type ToolAssignInput = z.infer<typeof toolAssignSchema>;
export type ToolReturnInput = z.infer<typeof toolReturnSchema>;
export type ToolSmsInput = z.infer<typeof toolSmsSchema>;

export function resolveToolCategory(input: ToolFormInput): string {
  if (input.category === "Autre" && input.customCategory?.trim()) {
    return input.customCategory.trim();
  }
  if (!TOOL_CATEGORIES.includes(input.category as (typeof TOOL_CATEGORIES)[number])) {
    return input.category.trim();
  }
  return input.category;
}
