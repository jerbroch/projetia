import { z } from "zod";

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  email: z.string().trim().email("Courriel invalide").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  company: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "lead"]).optional(),
});

export type CustomerFormInput = z.infer<typeof customerFormSchema>;
