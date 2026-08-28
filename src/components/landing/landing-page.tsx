import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ConstructionIosLogo } from "@/components/brand/construction-ios-logo";
import { InteractiveDemo } from "@/components/landing/interactive-demo";
import { Button } from "@/components/ui/button";

const benefits = [
  "Soumissions professionnelles",
  "Acceptation en ligne",
  "Dépôt optionnel",
  "Planification des employés",
  "Suivi des travaux",
  "Facturation",
  "Gestion depuis ordinateur ou mobile",
] as const;

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <ConstructionIosLogo size="sm" />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="sm:size-default">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild size="sm" className="sm:size-default">
              <Link href="/register">Créer un compte</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-muted/30">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Gérez votre entreprise de construction au même endroit.
              </h1>
              <p className="mt-5 text-pretty text-lg text-muted-foreground sm:text-xl">
                Clients, soumissions, planification, facturation et paiements — réunis dans une
                seule application.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4">
                <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/register">Créer un compte</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link href="/login">Se connecter</Link>
                  </Button>
                </div>
                <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
                  Vous avez un code bêta ou promo ? Vous pourrez l&apos;utiliser lors de
                  l&apos;inscription.
                </p>
              </div>
            </div>

            <div className="relative mx-auto mt-12 max-w-4xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Voyez-le en action
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                Suivez le projet de Marie, de la prise de contact au paiement
              </h2>
              <div className="mt-6 text-left">
                <InteractiveDemo />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Tout ce dont vous avez besoin
              </h2>
              <p className="mt-3 text-muted-foreground">
                Des outils pensés pour les entrepreneurs en construction.
              </p>
            </div>
            <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm font-medium sm:text-base">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">
              Construction iOS est actuellement disponible en bêta privée.
            </p>
            <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/register">Créer un compte</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/login">Se connecter</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <ConstructionIosLogo size="sm" />
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Construction iOS
          </p>
        </div>
      </footer>
    </div>
  );
}
