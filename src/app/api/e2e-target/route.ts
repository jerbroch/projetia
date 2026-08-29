import { NextResponse } from "next/server";

/**
 * Déclare quelle base de données CE SERVEUR vise réellement.
 *
 * La barrière e2e inspectait `process.env` du processus de test. Or Playwright
 * peut réutiliser un serveur déjà démarré (`reuseExistingServer`), lancé avec
 * un tout autre environnement — typiquement un `npm run dev` pointé sur la
 * production. La barrière voyait alors le dev déclaré dans .env.e2e pendant
 * que les tests écrivaient ailleurs. C'est exactement le scénario qu'elle
 * existe pour empêcher, ouvert par une autre porte.
 *
 * Ce point de contrôle permet de lui poser la question au bon endroit : au
 * serveur. La référence de projet n'est pas un secret — elle voyage déjà dans
 * le bundle client via NEXT_PUBLIC_SUPABASE_URL. On la referme tout de même
 * hors développement, faute d'usage légitime en production.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url.trim())?.[1] ?? null;

  return NextResponse.json({ projectRef });
}
