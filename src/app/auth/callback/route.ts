import { NextResponse } from "next/server";
import { activateEmployeeAccessAfterConfirmation } from "@/lib/actions/employee-access";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Un employé qui accepte son invitation voit son accès activé ici. Si
      // toutes les places de l'abonnement sont prises entre-temps, l'activation
      // est refusée : on l'envoie sur une page qui le lui explique, plutôt que
      // de le déposer dans une application où il n'a accès à rien.
      const activation = await activateEmployeeAccessAfterConfirmation(data.user.id);
      if (!activation.activated) {
        const url = new URL(`${origin}/invitation-en-attente`);
        if (activation.reason) url.searchParams.set("motif", activation.reason);
        return NextResponse.redirect(url);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
