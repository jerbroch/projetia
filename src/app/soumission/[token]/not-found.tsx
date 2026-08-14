import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function QuoteNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold">Soumission introuvable</h1>
      <p className="max-w-md text-muted-foreground">
        Ce lien est invalide ou a expiré. Contactez l&apos;entreprise qui vous a envoyé la
        soumission pour obtenir un nouveau lien.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </div>
  );
}
