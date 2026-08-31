"use server";

import { activateEmployeeAccessAfterConfirmation } from "@/lib/actions/employee-access";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validations/auth";

export interface SetInitialPasswordResult {
  success: boolean;
  error?: string;
  /** Où envoyer l'employé une fois le mot de passe posé. */
  destination?: string;
}

/**
 * Pose le premier mot de passe d'un employé invité, puis active son accès.
 *
 * L'ordre compte. L'activation vient APRÈS le mot de passe : un compte activé
 * sans mot de passe est un compte dont son propriétaire ne peut plus rien
 * faire dès que la session du lien expire.
 *
 * C'est aussi ici que tombe le drapeau `must_set_password`, celui que le
 * middleware consulte pour interdire /terrain tant que l'étape n'est pas
 * franchie.
 */
export async function setInitialPasswordAction(
  formData: FormData,
): Promise<SetInitialPasswordResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Mot de passe invalide." };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Votre lien a expiré. Demandez une nouvelle invitation." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { must_set_password: false },
  });

  if (error) {
    return { success: false, error: "Impossible d'enregistrer le mot de passe." };
  }

  const activation = await activateEmployeeAccessAfterConfirmation(user.id);
  if (!activation.activated) {
    const url = activation.reason
      ? `/invitation-en-attente?motif=${encodeURIComponent(activation.reason)}`
      : "/invitation-en-attente";
    return { success: true, destination: url };
  }

  return { success: true, destination: "/terrain" };
}
