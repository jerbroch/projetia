import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * CE QU'ON VOIT PENDANT QUE LES CHIFFRES ARRIVENT.
 *
 * Le tableau de bord attendait d'avoir TOUT — contexte, horaire, clients,
 * factures, fiches de facturation — avant d'envoyer le moindre octet :
 * mesuré à près de six dixièmes de seconde d'écran figé sur la page
 * précédente. Le châssis part maintenant tout de suite et ce squelette tient
 * la place des données, qui arrivent en continu derrière.
 *
 * IL A LA FORME DE CE QU'IL REMPLACE : quatre cartes, une bande, deux
 * colonnes. Un squelette qui ne ressemble pas au contenu fait sauter la mise
 * en page à l'arrivée des vraies données, et ce sursaut se remarque plus que
 * l'attente qu'il masque.
 *
 * `animate-pulse` s'arrête si les animations sont refusées : la structure
 * reste, seul le battement disparaît.
 */
function Barre({ className }: { className?: string }) {
  return (
    <span
      className={cn("block rounded bg-muted-foreground/15 motion-safe:animate-pulse", className)}
    />
  );
}

export function SqueletteTableau() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="col-span-2 xl:col-span-1">
          <Card className="h-full bg-petrole p-5">
            <Barre className="h-4 w-28 bg-white/20" />
            <Barre className="mt-4 h-8 w-32 bg-white/20" />
          </Card>
        </div>
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex h-full flex-col p-4 sm:p-5">
            <Barre className="h-[18px] w-[18px]" />
            <Barre className="mt-3 h-4 w-24" />
            <Barre className="mt-3 h-7 w-12" />
          </Card>
        ))}
      </div>

      <Card className="flex flex-col divide-y divide-border/70 p-1 sm:flex-row sm:divide-x sm:divide-y-0">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-3.5 px-4 py-3.5 sm:px-5">
            <Barre className="h-7 w-7 rounded-full" />
            <span className="min-w-0 flex-1">
              <Barre className="h-4 w-40" />
              <Barre className="mt-2 h-6 w-8" />
            </span>
          </div>
        ))}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((c) => (
          <Card key={c} className="flex min-w-0 flex-col p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <Barre className="h-5 w-44" />
              <Barre className="h-4 w-24" />
            </div>
            <div className="mt-5 space-y-3.5">
              {[0, 1, 2].map((l) => (
                <div key={l} className="flex items-start gap-3.5">
                  <Barre className="h-12 w-12 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <Barre className="h-4 w-3/5" />
                    <Barre className="mt-2 h-3 w-2/5" />
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
