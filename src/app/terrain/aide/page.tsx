import { ContactBlock } from "@/components/shared/contact-block";
import { FieldLayout } from "@/components/field/field-layout";
import { coordonneesDeLEmployeur } from "@/lib/coordonnees";
import { requireFieldContext } from "@/lib/session";

/**
 * L'employé joint SON EMPLOYEUR, jamais nous.
 *
 * Un gars bloqué sur un chantier appelle son patron : nous ne saurions rien
 * lui dire de son chantier, et le renvoyer vers nous casserait cette relation.
 * Les coordonnées viennent des paramètres de son entreprise — déjà en base.
 */
export default async function TerrainAidePage() {
  const ctx = await requireFieldContext();
  const coordonnees = coordonneesDeLEmployeur(ctx.company);

  return (
    <FieldLayout company={ctx.company} user={ctx.user}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Joindre {ctx.company.name}</h1>
          <p className="text-sm text-muted-foreground">
            Une question sur un chantier, un empêchement, un retard
          </p>
        </div>

        {coordonnees ? (
          <ContactBlock coordonnees={coordonnees} />
        ) : (
          /*
            Ni courriel ni téléphone dans la fiche de l'entreprise. On le dit
            plutôt que d'afficher un cadre vide, et on nomme la cause : c'est
            l'employeur qui doit remplir ses coordonnées, pas l'employé.
          */
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Aucune coordonnée enregistrée</p>
            <p className="mt-1">
              {ctx.company.name} n&apos;a pas encore inscrit de téléphone ni de
              courriel dans ses paramètres. Demandez-les à votre contremaître.
            </p>
          </div>
        )}
      </div>
    </FieldLayout>
  );
}
