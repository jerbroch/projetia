import { z } from "zod";

export const employeeFormSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  trade: z.string().trim().min(1, "Le métier est requis"),
  email: z.string().trim().email("Courriel invalide").optional().or(z.literal("")),
  mobilePhone: z.string().trim().optional(),
  truckNumber: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "vacation", "sick"]).optional(),
  profilePhoto: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  department: z.string().trim().optional(),
  hireDate: z.string().trim().optional(),
  hourlyRate: z.string().trim().optional(),
});

export type EmployeeFormInput = z.infer<typeof employeeFormSchema>;
