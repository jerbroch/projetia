import { ConstructionIosLogo } from "@/components/brand/construction-ios-logo";
import { activationRefusedMessage } from "@/lib/billing/pending-invitations";

/**
 * Page vue par un EMPLOYÉ dont l'invitation est valide mais dont l'accès n'a
 * pas pu être activé — toutes les places de l'abonnement sont occupées.
 *
 * Elle existe pour éviter deux mauvaises issues : le déposer dans une
 * application où il n'a accès à rien, ou lui montrer une erreur qui lui
 * ferait croire qu'il s'est trompé. Il n'y est pour rien, et réessayer ne
 * changera rien : seul son employeur peut débloquer la situation.
 */
export default async function InvitationEnAttentePage({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string }>;
}) {
  const { motif } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-6">
      <div className="text-center">
        <ConstructionIosLogo size="sm" showName={false} className="mx-auto justify-center" />
        <h1 className="mt-6 text-2xl font-bold">Votre invitation est bien reçue</h1>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-6 text-sm leading-relaxed">
        <p>{motif?.trim() || activationRefusedMessage()}</p>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Aucune action n&apos;est nécessaire de votre part. Une fois la place
        libérée, reprenez le lien de votre courriel d&apos;invitation.
      </p>
    </div>
  );
}
