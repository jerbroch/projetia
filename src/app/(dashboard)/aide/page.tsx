import { ContactBlock } from "@/components/shared/contact-block";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { coordonneesDuSoutien } from "@/lib/coordonnees";
import { requireTenantContext } from "@/lib/session";

/**
 * Nous joindre, DANS LE MENU PRINCIPAL.
 *
 * Un entrepreneur bloqué un mardi matin ne pense pas à fouiller les réglages.
 * L'entrée est donc à côté de Paramètres, visible sans qu'on la cherche, et
 * les coordonnées sont composables d'un toucher.
 */
export default async function AidePage() {
  const ctx = await requireTenantContext();
  const coordonnees = coordonneesDuSoutien();

  return (
    <DashboardLayout
      user={ctx.user}
      company={ctx.company}
      isDemo={ctx.isDemo}
      title="Nous joindre"
      description="Une question, un blocage, une idée — écrivez ou appelez"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Soutien Construction iOS</CardTitle>
            <CardDescription>
              Vous parlez à la personne qui construit l&apos;application, pas à un
              service. Du lundi au vendredi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactBlock coordonnees={coordonnees} compact />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ce qui aide à vous répondre vite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Le nom de votre entreprise&nbsp;:{" "}
              <span className="font-medium text-foreground">{ctx.company.name}</span>
            </p>
            <p>
              L&apos;écran où ça bloque — soumission, calendrier, facture — et ce
              que vous veniez de faire.
            </p>
            <p>
              Le numéro du document en cause, s&apos;il y en a un&nbsp;: SO-2026-0141,
              FA-2026-0288.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
