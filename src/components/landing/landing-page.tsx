import Link from "next/link";
import { Calendar, CheckCircle2, CreditCard, FileText, Receipt, Users } from "lucide-react";
import { ConstructionIosLogo } from "@/components/brand/construction-ios-logo";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: 1,
    title: "Clients",
    description: "Centralisez vos contacts, projets et historique client.",
    icon: Users,
  },
  {
    number: 2,
    title: "Soumissions",
    description: "Créez et envoyez des soumissions professionnelles en quelques clics.",
    icon: FileText,
  },
  {
    number: 3,
    title: "Planification",
    description: "Organisez les équipes et les chantiers dans un calendrier partagé.",
    icon: Calendar,
  },
  {
    number: 4,
    title: "Facturation",
    description: "Générez vos factures à partir des travaux réalisés.",
    icon: Receipt,
  },
  {
    number: 5,
    title: "Paiement",
    description: "Encaissez en ligne par carte ou Interac selon vos préférences.",
    icon: CreditCard,
  },
] as const;

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
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 flex justify-center">
                <ConstructionIosLogo size="lg" showName={false} />
              </div>
              <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Gérez votre entreprise de construction au même endroit.
              </h1>
              <p className="mt-5 text-pretty text-lg text-muted-foreground sm:text-xl">
                Clients, soumissions, planification, facturation et paiements — réunis dans une
                seule application.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4">
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
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Comment ça fonctionne</h2>
            <p className="mt-3 text-muted-foreground">
              Un flux simple, de la première prise de contact au paiement final.
            </p>
          </div>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => (
              <li
                key={step.number}
                className="relative flex flex-col rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {step.number}
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
                    <step.icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
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
