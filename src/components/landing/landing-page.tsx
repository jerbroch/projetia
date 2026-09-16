import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ConstructionIosLogo } from "@/components/brand/construction-ios-logo";
import { PlanArchitectural } from "@/components/brand/plan-architectural";
import { ContactBlock } from "@/components/shared/contact-block";
import { coordonneesDuSoutien } from "@/lib/coordonnees";
import { InteractiveDemo } from "@/components/landing/interactive-demo";
import { Button } from "@/components/ui/button";
import { argent, ECARTS, GAIN } from "@/lib/demo-chantier";
import { QuestionsReelles } from "@/components/landing/questions-reelles";
import { LigneDevenueCarte } from "@/components/landing/ligne-devenue-carte";
import { LogoQuiSeConstruit } from "@/components/brand/logo-qui-se-construit";
import { VoirEnAction } from "@/components/landing/voir-en-action";

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
        {/*
          LE HÉROS — « du plan au chantier ».

          Le plan est le seul décor qu'un entrepreneur lit sans qu'on le lui
          explique : il en a un sur le capot de son camion. Il tient la même
          promesse que la page de connexion, avec le même fond bleu nuit dans
          les deux thèmes — un plan n'est pas blanc.
        */}
        <section className="relative overflow-hidden bg-[hsl(var(--plan-fond))]">
          <PlanArchitectural pas={30} />
          {/*
            LE VOILE. Sans lui, les refends du plan traversent le titre et le
            sous-titre : le décor devient du bruit posé sur la seule phrase que
            la page doit faire lire. Opaque au centre, transparent sur les
            bords — le plan reste visible là où il ne gêne personne.
          */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,hsl(var(--plan-fond))_0%,hsl(var(--plan-fond)/0.92)_38%,hsl(var(--plan-fond)/0.55)_62%,transparent_85%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--plan-accent)/0.16)_0%,transparent_60%)]" />

          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="mx-auto max-w-3xl text-center">
              {/* Le logo se construit AVANT le titre : c'est le geste qui
                  annonce le concept, pas une décoration qui le suit. */}
              <div className="flex flex-col items-center gap-3">
                <LogoQuiSeConstruit taille={60} delaiMs={120} />
                <p
                  className="plan-monter text-sm font-semibold uppercase tracking-[0.18em] text-primary"
                  style={{ animationDelay: "60ms" }}
                >
                  Du plan au chantier
                </p>
              </div>
              <h1
                className="plan-monter mt-4 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
                style={{ animationDelay: "140ms" }}
              >
                De la première soumission au dernier paiement.
              </h1>
              <p
                className="plan-monter mx-auto mt-6 max-w-2xl text-pretty text-lg text-[hsl(var(--plan-trait))]/85 sm:text-xl"
                style={{ animationDelay: "220ms" }}
              >
                Construction iOS réunit vos clients, vos soumissions, vos employés, vos
                chantiers et votre facturation dans un seul espace de travail.
              </p>

              <div
                className="plan-monter mt-10 flex flex-col items-center gap-4"
                style={{ animationDelay: "300ms" }}
              >
                <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    {/* La gratuité est NOMMÉE ET BORNÉE : « Démarrer gratuitement »
                        laisserait croire à un produit gratuit, et la surprise
                        arriverait au trentième jour. */}
                    <Link href="/register">Essayer 30 jours gratuits</Link>
                  </Button>
                  <VoirEnAction />
                </div>
                <p className="max-w-md text-xs text-[hsl(var(--plan-trait))]/70 sm:text-sm">
                  Vous avez un code bêta ou promo ? Vous pourrez l&apos;utiliser lors de
                  l&apos;inscription.
                </p>
              </div>
            </div>

            {/* Le plan devient l'application, littéralement. */}
            <LigneDevenueCarte />
          </div>
        </section>

        {/*
          LE CHIFFRE. C'est lui qui fait arrêter de défiler, pas une promesse.

          742,17 $ n'est pas un argument marketing : c'est l'écart calculé par
          la démo ci-dessous, entre la soumission et la facture réelle du même
          chantier. On l'annonce ici et on le démontre juste après — dans cet
          ordre, sinon c'est une affirmation de plus.
        */}
        <section className="border-b bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
              <div className="text-center lg:text-left">
                <p className="text-sm font-semibold uppercase tracking-wide text-accent-encre">
                  Sur un seul chantier
                </p>
                {/* CALCULÉ, pas recopié. Voir `@/lib/demo-chantier`. */}
                <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums text-foreground sm:text-6xl lg:text-7xl">
                  {argent(GAIN).replace(" $", "\u00a0$")}
                </p>
                <div className="mx-auto mt-3 h-1 w-24 rounded-full bg-primary lg:mx-0" />
              </div>
              <div className="max-w-xl text-center lg:text-left">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  L&apos;écart entre ce que vous avez soumis et ce que vous avez vraiment
                  fait.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Deux salles de bain à Lévis.{" "}
                  {ECARTS.heuresCompagnon.toLocaleString("fr-CA")} h de compagnon de plus
                  que prévu, {ECARTS.heuresApprenti.toLocaleString("fr-CA")} h
                  d&apos;apprenti, {ECARTS.coudes} coudes de cuivre. Rien d&apos;anormal —
                  c&apos;est un chantier ordinaire. Suivez-le ci-dessous, de la soumission
                  au paiement.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* LE PARCOURS. */}
        <section
          id="demonstration"
          tabIndex={-1}
          className="mx-auto max-w-6xl px-4 py-14 outline-none sm:px-6 sm:py-16 lg:px-8"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Un chantier, du premier prix au dernier dollar encaissé
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Les heures et les matériaux saisis au chantier remontent seuls dans la
              facture. Les écrans ci-dessous sont ceux de l&apos;application, et les
              totaux sont calculés — pas recopiés.
            </p>
          </div>
          <div className="mt-8 text-left">
            <InteractiveDemo />
          </div>
        </section>

        {/* LES QUESTIONS. */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Cinq questions, et vous saurez si ça vous parle
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Si vous avez une réponse claire aux cinq, vous n&apos;avez pas besoin de
                nous.
              </p>
            </div>
            <QuestionsReelles />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
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
                className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm transition-colors duration-200 hover:border-primary/40"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm font-medium sm:text-base">{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
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
          </div>
        </section>

        {/*
          Nous joindre, avant le pied de page.

          Un entrepreneur qui hésite devant 89,99 $/mois veut d'abord savoir
          qu'il y a quelqu'un derrière. Un formulaire de contact ne répond pas
          à cette question — un numéro qu'on peut composer tout de suite, oui.
        */}
        <section id="nous-joindre" className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Une question avant de vous lancer&nbsp;?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Vous parlez à la personne qui construit l&apos;application, pas à un
                service. Appelez, écrivez — on vous répond.
              </p>
            </div>
            <div className="mx-auto mt-8 max-w-md">
              <ContactBlock coordonnees={coordonneesDuSoutien()} />
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
