"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { clearDemoSession, setDemoSession } from "@/lib/demo/session";
import { isDemoLoginEnabled } from "@/lib/demo/constants";
import {
  forgotPasswordSchema,
  loginSchema,
  onboardingCompanySchema,
  onboardingCustomerSchema,
  onboardingEmployeeSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { requireTenantContext, getPostLoginRedirectPath } from "@/lib/session";
import { safeNextPath } from "@/lib/safe-next-path";
import {
  insertCustomerForCompany,
  insertEmployeeForCompany,
  updateCompanySettings,
} from "@/lib/data/tenant-data";

export type ActionResult = { success: true } | { success: false; error: string };

function safeError(message: string): ActionResult {
  return { success: false, error: message };
}

function isSchemaNotReadyError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("does not exist");
}

export async function registerAction(formData: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return safeError("L'inscription nécessite la configuration Supabase.");
  }

  const parsed = registerSchema.safeParse({
    companyName: formData.get("companyName"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms") === "on" ? true : formData.get("acceptTerms"),
    acceptPrivacy: formData.get("acceptPrivacy") === "on" ? true : formData.get("acceptPrivacy"),
  });

  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const { companyName, firstName, lastName, email, phone, password } = parsed.data;
  const admin = createAdminClient();

  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profileLookupError) {
    if (isSchemaNotReadyError(profileLookupError.message)) {
      console.error("Registration blocked — database schema not applied:", profileLookupError.message);
      return safeError(
        "La base de données n'est pas encore configurée. Appliquez la migration Supabase, puis réessayez."
      );
    }
    console.error("Profile lookup failed:", profileLookupError.message);
    return safeError("Impossible de vérifier le courriel. Veuillez réessayer.");
  }

  if (existingProfile) {
    return safeError("Un compte existe déjà avec ce courriel.");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (signUpError || !signUpData.user) {
    if (signUpError?.message?.includes("already")) {
      return safeError("Un compte existe déjà avec ce courriel.");
    }
    return safeError("Impossible de créer le compte. Veuillez réessayer.");
  }

  const userId = signUpData.user.id;

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: companyName,
      email,
      phone: phone || null,
      subscription_status: "cancelled",
      access_type: "pending",
      requires_access_choice: true,
      trial_ends_at: null,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    console.error("Company creation failed:", companyError?.message);
    await admin.auth.admin.deleteUser(userId);
    if (isSchemaNotReadyError(companyError?.message)) {
      return safeError(
        "La base de données n'est pas encore configurée. Appliquez la migration Supabase, puis réessayez."
      );
    }
    return safeError("Impossible de créer l'entreprise. Veuillez réessayer.");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    company_id: company.id,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone || null,
    role: "owner",
    status: "active",
  });

  if (profileError) {
    await admin.from("companies").delete().eq("id", company.id);
    await admin.auth.admin.deleteUser(userId);
    return safeError("Impossible de créer le profil. Veuillez réessayer.");
  }

  const { error: memberError } = await admin.from("company_members").insert({
    company_id: company.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.from("companies").delete().eq("id", company.id);
    await admin.auth.admin.deleteUser(userId);
    return safeError("Impossible de finaliser l'inscription. Veuillez réessayer.");
  }

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      company_id: company.id,
      role: "owner",
    },
  });

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  // Sign-in may fail when Supabase requires email confirmation first — account still exists.
  if (signInError) {
    const isUnconfirmedEmail =
      signInError.message.toLowerCase().includes("email not confirmed") ||
      signInError.message.toLowerCase().includes("email_not_confirmed");
    if (!isUnconfirmedEmail) {
      console.error("Post-registration sign-in failed:", signInError.message);
    }
  }

  const { error: resendError } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding` },
  });

  if (resendError) {
    console.error("Failed to send verification email:", resendError.message);
  }

  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  if (!isSupabaseConfigured()) {
    return safeError("La connexion nécessite la configuration Supabase.");
  }

  await clearDemoSession();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return safeError("Courriel ou mot de passe invalide.");
  }

  if (!data.user.email_confirmed_at) {
    redirect("/verify-email");
  }

  // Destination demandée avant la connexion (posée par le middleware).
  // Validée : un `next` externe transformerait /login en redirection ouverte.
  const requested = safeNextPath(
    typeof formData.get("next") === "string" ? String(formData.get("next")) : null,
  );

  redirect(requested ?? (await getPostLoginRedirectPath()));
}

export async function demoLoginAction(): Promise<ActionResult> {
  if (!isDemoLoginEnabled()) {
    return safeError("Le compte de démonstration n'est pas disponible.");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  await setDemoSession();
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearDemoSession();
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function forgotPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Courriel invalide");
  }

  if (!isSupabaseConfigured()) {
    return safeError("Réinitialisation indisponible — Supabase non configuré.");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return safeError("Impossible d'envoyer le courriel. Veuillez réessayer.");
  }

  return { success: true };
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Mot de passe invalide");
  }

  if (!isSupabaseConfigured()) {
    return safeError("Réinitialisation indisponible.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return safeError("Impossible de mettre à jour le mot de passe.");
  }

  redirect("/login?reset=success");
}

export async function resendVerificationAction(emailOverride?: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return safeError("Service indisponible.");
  }

  const supabase = await createClient();
  let email = emailOverride?.trim() || undefined;
  if (!email) {
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? undefined;
  }
  if (!email) {
    return safeError("Courriel introuvable. Reconnectez-vous ou réessayez l'inscription.");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding` },
  });

  if (error) {
    return safeError("Impossible de renvoyer le courriel.");
  }

  return { success: true };
}

export async function saveOnboardingCompanyAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Non disponible pour le compte de démonstration.");

  const parsed = onboardingCompanySchema.safeParse({
    legalName: formData.get("legalName") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    city: formData.get("city") || undefined,
    province: formData.get("province") || "QC",
    postalCode: formData.get("postalCode") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    gstRate: formData.get("gstRate") || 0.05,
    qstRate: formData.get("qstRate") || 0.09975,
  });

  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const d = parsed.data;
  const { error } = await updateCompanySettings(ctx.company.id, {
    legal_name: d.legalName || null,
    phone: d.phone || null,
    email: d.email || null,
    address: d.address || null,
    city: d.city || null,
    province: d.province,
    postal_code: d.postalCode || null,
    logo_url: d.logoUrl || null,
    gst_rate: d.gstRate,
    qst_rate: d.qstRate,
  });

  if (error) return safeError("Impossible de sauvegarder les informations.");
  return { success: true };
}

export async function saveOnboardingEmployeeAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: true };

  const parsed = onboardingEmployeeSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    trade: formData.get("trade") || undefined,
  });

  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const { error } = await insertEmployeeForCompany(ctx.company.id, parsed.data);
  if (error) return safeError("Impossible d'ajouter l'employé.");
  return { success: true };
}

export async function saveOnboardingCustomerAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: true };

  const parsed = onboardingCustomerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
  });

  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const { error } = await insertCustomerForCompany(ctx.company.id, parsed.data);
  if (error) return safeError("Impossible d'ajouter le client.");
  return { success: true };
}

export async function finishOnboardingAction(): Promise<void> {
  await requireTenantContext();
  redirect("/choose-plan");
}

export async function updateCompanySettingsAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Les paramètres du compte démo ne peuvent pas être modifiés.");

  if (ctx.membershipRole !== "owner" && ctx.membershipRole !== "admin") {
    return safeError("Accès refusé.");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return safeError("Le nom de l'entreprise est requis.");

  const { error } = await updateCompanySettings(ctx.company.id, {
    name,
    legal_name: formData.get("legalName") || null,
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    address: formData.get("address") || null,
    city: formData.get("city") || null,
    province: formData.get("province") || "QC",
    postal_code: formData.get("postalCode") || null,
    primary_color: formData.get("primaryColor") || null,
    gst_rate: Number(formData.get("gstRate") ?? 0.05),
    qst_rate: Number(formData.get("qstRate") ?? 0.09975),
  });

  if (error) return safeError("Impossible de sauvegarder.");
  return { success: true };
}
