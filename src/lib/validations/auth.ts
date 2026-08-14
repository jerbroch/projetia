import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Courriel invalide");

const passwordSchema = z
  .string()
  .min(10, "Le mot de passe doit contenir au moins 10 caractères")
  .regex(/[A-Z]/, "Le mot de passe doit contenir une majuscule")
  .regex(/[a-z]/, "Le mot de passe doit contenir une minuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir un chiffre")
  .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir un caractère spécial");

export const registerSchema = z
  .object({
    companyName: z.string().trim().min(2, "Le nom de l'entreprise est requis"),
    firstName: z.string().trim().min(1, "Le prénom est requis"),
    lastName: z.string().trim().min(1, "Le nom est requis"),
    email: emailSchema,
    phone: z.string().trim().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation" }),
    }),
    acceptPrivacy: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter la politique de confidentialité" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Le mot de passe est requis"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export const onboardingCompanySchema = z.object({
  legalName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Courriel invalide").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  province: z.string().trim().default("QC"),
  postalCode: z.string().trim().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  gstRate: z.coerce.number().min(0).max(1).default(0.05),
  qstRate: z.coerce.number().min(0).max(1).default(0.09975),
});

export const onboardingEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  trade: z.string().trim().optional(),
});

export const onboardingCustomerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
});
