"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/client";

/**
 * Relais qui récupère une session déposée dans le FRAGMENT de l'URL.
 *
 * Le flux implicite de Supabase — celui des invitations employé — renvoie
 * `#access_token=…&refresh_token=…`. Un fragment n'est jamais transmis au
 * serveur : seule une page cliente peut le lire. /auth/callback nous redirige
 * ici quand il n'a trouvé ni `code` ni `token_hash`, et le navigateur reporte
 * le fragment au passage.
 *
 * On lit le fragment explicitement plutôt que de compter sur la détection
 * automatique du SDK : le comportement de `detectSessionInUrl` dépend du mode
 * de flux configuré, et on ne veut pas que le parcours d'invitation repose sur
 * un réglage implicite.
 */
function RelaisLien() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    const destination = safeNextPath(searchParams.get("next")) ?? "/dashboard";

    async function etablirSession() {
      const supabase = createClient();
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setEchec(true);
          return;
        }
        // On efface les jetons de la barre d'adresse : ils ne doivent pas
        // rester dans l'historique ni partir dans un en-tête Referer.
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setEchec(true);
        return;
      }

      router.replace(destination);
    }

    void etablirSession();
  }, [router, searchParams]);

  if (echec) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6 text-center">
        <h1 className="text-xl font-semibold">Ce lien n&apos;est plus valide</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Il a peut-être déjà été utilisé, ou il a expiré. Demandez à votre
          employeur de vous renvoyer une invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Ouverture de votre accès…</p>
    </div>
  );
}

export default function LienPage() {
  return (
    <Suspense>
      <RelaisLien />
    </Suspense>
  );
}
