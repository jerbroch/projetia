import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { activateEmployeeAccessAfterConfirmation } from "@/lib/actions/employee-access";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

/**
 * Point d'atterrissage des liens envoyés par courriel.
 *
 * Supabase renvoie les identifiants sous TROIS formes selon le type de lien et
 * la configuration du projet :
 *
 *   1. `?code=…`        — flux PKCE, échangeable côté serveur.
 *   2. `?token_hash=…&type=…` — quand le gabarit utilise `{{ .TokenHash }}`.
 *   3. `#access_token=…&refresh_token=…` — flux implicite.
 *
 * La troisième est celle des invitations employé. Vérifié en suivant un vrai
 * lien : `/auth/v1/verify?type=invite` répond
 * `303 → /auth/callback?next=…#access_token=…&type=invite`.
 *
 * UN FRAGMENT N'EST JAMAIS ENVOYÉ AU SERVEUR. Cette route ne peut donc pas le
 * lire, et c'est pour ça que l'invitation échouait ici. On délègue alors à
 * /auth/lien, une page cliente qui, elle, voit le fragment. Le navigateur
 * reporte le fragment sur la nouvelle adresse quand celle-ci n'en a pas —
 * c'est ce qui rend le relais possible.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next")) ?? "/dashboard";

  const supabase = await createClient();
  let userId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return echec(origin);
    userId = data.user.id;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error || !data.user) return echec(origin);
    userId = data.user.id;
  } else {
    // Ni l'un ni l'autre : les identifiants sont probablement dans le fragment.
    const relais = new URL(`${origin}/auth/lien`);
    relais.searchParams.set("next", next);
    return NextResponse.redirect(relais);
  }

  // Un employé qui accepte son invitation voit son accès activé ici. Si toutes
  // les places de l'abonnement sont prises entre-temps, l'activation est
  // refusée : on l'envoie sur une page qui le lui explique, plutôt que de le
  // déposer dans une application où il n'a accès à rien.
  const activation = await activateEmployeeAccessAfterConfirmation(userId);
  if (!activation.activated) {
    const url = new URL(`${origin}/invitation-en-attente`);
    if (activation.reason) url.searchParams.set("motif", activation.reason);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

function echec(origin: string): NextResponse {
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
