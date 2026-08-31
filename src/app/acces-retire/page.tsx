import { ConstructionIosLogo } from "@/components/brand/construction-ios-logo";

/**
 * Page vue par quelqu'un dont l'accès à l'application a été retiré.
 *
 * Elle existe pour éviter deux mauvaises issues : le laisser entrer, ou le
 * renvoyer sur une page de connexion qui lui ferait croire à une erreur de
 * mot de passe et l'inviterait à réessayer indéfiniment.
 */
export default function AccesRetirePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-6">
      <div className="text-center">
        <ConstructionIosLogo size="sm" showName={false} className="mx-auto justify-center" />
        <h1 className="mt-6 text-2xl font-bold">Votre accès a été retiré</h1>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-6 text-sm leading-relaxed">
        <p>
          Votre employeur a fermé votre accès à l&apos;application. Il n&apos;y a
          rien à corriger de votre côté, et réessayer ne changera rien.
        </p>
        <p className="mt-4">
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez
          directement votre employeur : lui seul peut rouvrir l&apos;accès.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Vos heures et le travail déjà saisis sont conservés.
      </p>
    </div>
  );
}
