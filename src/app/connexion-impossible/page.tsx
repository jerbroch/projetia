import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * QUAND ON N'A PAS PU VÉRIFIER QUI EST LÀ.
 *
 * Ni accès, ni écran de connexion. Le témoin de session n'a pas été effacé :
 * la personne est probablement connectée, on n'a simplement pas pu le
 * confirmer. Lui redemander son mot de passe serait lui faire payer une
 * coupure réseau.
 *
 * CETTE PAGE N'EST PAS PROTÉGÉE, et c'est essentiel : le middleware ne tourne
 * pas dessus (elle est hors du matcher) et `isPublicRoute` la reconnaît en
 * plus. Sinon une vérification impossible redirigerait vers une page qui
 * redirigerait vers une vérification impossible — une boucle qui ne se verrait
 * qu'en production, le jour où le réseau tombe.
 */
export const dynamic = "force-dynamic";

export default async function ConnexionImpossiblePage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  // On ne renvoie que vers l'application elle-même : une destination venue de
  // l'URL ne doit pas pouvoir expédier ailleurs.
  const destination = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Connexion au serveur impossible</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Nous n&apos;avons pas pu joindre le serveur pour vérifier votre session.
          <strong className="text-foreground"> Vous n&apos;avez pas été déconnecté</strong> —
          il s&apos;agit d&apos;un problème de réseau, pas de votre compte.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Vérifiez votre signal, puis réessayez. Vous reviendrez où vous alliez.
        </p>

        <Button asChild className="mt-6 w-full">
          <Link href={destination}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Réessayer
          </Link>
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Si cela se répète, vous pouvez{" "}
          <Link href="/login" className="text-primary hover:underline">
            vous reconnecter
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
