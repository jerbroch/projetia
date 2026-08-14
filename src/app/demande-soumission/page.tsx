import Link from "next/link";
import { HardHat } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Public quote request landing — does not require authentication */
export default function QuoteRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Demande de soumission</CardTitle>
          <CardDescription>
            Formulaire public pour recevoir des demandes de soumission de vos clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ce formulaire sera lié à votre entreprise une fois Supabase configuré.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Connexion entreprise</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
