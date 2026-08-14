import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SupportModeDisabledBanner() {
  return (
    <Card className="border-dashed border-amber-300 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-base text-amber-900">
          Mode support — architecture préparée, désactivé
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-amber-900">
        <p>
          La table <code>support_mode_sessions</code> est prête, mais la fonctionnalité « Voir
          comme cette entreprise » n&apos;est pas activée pour des raisons de sécurité.
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>Accès super_admin uniquement avec vérification serveur</li>
          <li>Bannière visible et journal d&apos;audit début/fin requis</li>
          <li>Lecture seule par défaut — pas de contournement RLS non contrôlé</li>
          <li>Pas de service_role dans le navigateur</li>
        </ul>
        <p className="text-xs">
          Voir <code>docs/PLATFORM_EXTENSIONS.md</code> pour le plan d&apos;activation.
        </p>
      </CardContent>
    </Card>
  );
}
