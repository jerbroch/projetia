"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, HardHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChampMotDePasse } from "@/components/ui/champ-mot-de-passe";
import { VoletPlan } from "@/components/auth/volet-plan";
import { TransitionConnexion } from "@/components/auth/transition-connexion";
import { PlanArchitectural } from "@/components/brand/plan-architectural";
import { demoLoginAction, loginAction } from "@/lib/actions/auth";
import { isDemoLoginEnabled } from "@/lib/demo/constants";

/**
 * LA PORTE D'ENTRÉE DE CONSTRUCTION iOS.
 *
 * Deux volets sur ordinateur : le plan à gauche, la connexion à droite. Sur
 * téléphone, le formulaire d'abord — le plan y devient un bandeau, parce
 * qu'on ouvre cette page pour taper son courriel, pas pour regarder un décor.
 *
 * L'ANIMATION DE SUCCÈS NE PEUT PAS MENTIR. Elle n'est montée que lorsque
 * `loginAction` a rendu une destination, ce qui n'arrive qu'après une
 * authentification confirmée par Supabase. Mot de passe refusé, compte non
 * confirmé, coupure réseau : aucun de ces chemins ne la traverse.
 *
 * Et elle ne ralentit rien : la navigation part en même temps qu'elle.
 */
type EtatBouton = "repos" | "chargement" | "confirme" | "succes" | "erreur";

/**
 * Le temps que le crochet reste seul à l'écran avant que la transition prenne
 * le relais. Assez pour être vu, trop court pour être attendu — et il tombe
 * DANS le temps de chargement du tableau de bord, qu'il ne rallonge pas.
 */
const DUREE_CROCHET_MS = 260;

/**
 * Le temps laissé à la navigation cliente avant de la doubler par une vraie
 * navigation. Assez long pour qu'un `router.push` normal ait fini, assez
 * court pour qu'on ne reste pas devant un écran figé.
 */
const DELAI_FILET_MS = 1200;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  /** Vrai quand l'échec a une suite : aller confirmer son adresse. */
  const [aConfirmer, setAConfirmer] = useState(false);
  const [etat, setEtat] = useState<EtatBouton>("repos");
  const [demoLoading, setDemoLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const showDemo = isDemoLoginEnabled();

  /** La destination rendue par le serveur. Le client n'en choisit aucune. */
  const destination = useRef<string | null>(null);
  /** Empêche la double soumission, y compris par la touche Entrée. */
  const enVol = useRef(false);
  /** Retenu pour pouvoir renvoyer le courriel de confirmation à la bonne adresse. */
  const courriel = useRef("");

  useEffect(() => {
    if (searchParams.get("reset") === "success") setError("");
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Deux barrières : l'état désactive le bouton, la référence attrape le
    // double clic parti avant le rendu suivant.
    if (enVol.current) return;
    enVol.current = true;

    setEtat("chargement");
    setError("");
    setAConfirmer(false);

    const formData = new FormData(e.currentTarget);
    courriel.current = String(formData.get("email") ?? "");
    startTransition(async () => {
      const result = await loginAction(formData);
      if (!result.success) {
        setError(result.error);
        setAConfirmer(result.motif === "non-confirme");
        setEtat("erreur");
        enVol.current = false;
        return;
      }
      // Supabase a confirmé. C'est le SEUL chemin vers l'animation.
      destination.current = result.destination;
      // LE CROCHET D'ABORD, la transition ensuite. J'avais d'abord rendu la
      // transition immédiatement, ce qui rendait l'état « succès » du bouton
      // inatteignable — je l'avais alors supprimé comme mort, au lieu de
      // réordonner la séquence pour qu'il vive. Le crochet est le moment où
      // l'on apprend que ça a marché ; l'escamoter, c'est passer du doute au
      // tableau de bord sans jamais dire « c'est bon ».
      setEtat("confirme");
      window.setTimeout(() => setEtat("succes"), DUREE_CROCHET_MS);
    });
  }

  /**
   * LA NAVIGATION APRÈS LA CONNEXION, AVEC UN FILET.
   *
   * `router.push` seul suffisait pour le tableau de bord mais laissait un
   * employé bloqué sur l'animation, indéfiniment : sa destination est
   * `/terrain`, que le middleware traite à part, et la navigation cliente
   * était abandonnée en silence sans erreur ni changement d'URL. Mesuré —
   * la session était valide, un `goto /terrain` aboutissait, seul le
   * `router.push` restait sur place.
   *
   * On garde donc `router.push` pour la fluidité, et on vérifie qu'il a
   * porté. S'il n'a rien fait, une vraie navigation prend le relais : mieux
   * vaut un rechargement complet qu'un écran qui ne finit jamais.
   */
  const naviguer = useCallback(() => {
    const cible = destination.current;
    if (!cible) return;

    router.push(cible);

    window.setTimeout(() => {
      // Toujours sur la page de connexion : la navigation cliente n'a pas
      // abouti. `assign` conserve l'historique, contrairement à `replace`.
      if (window.location.pathname === "/login") {
        window.location.assign(cible);
      }
    }, DELAI_FILET_MS);
  }, [router]);

  async function handleDemoLogin() {
    if (enVol.current) return;
    enVol.current = true;
    setDemoLoading(true);
    setError("");
    startTransition(async () => {
      const result = await demoLoginAction();
      if (result && !result.success) {
        setError(result.error);
        setDemoLoading(false);
        enVol.current = false;
      }
    });
  }

  const successMessage =
    searchParams.get("reset") === "success"
      ? "Mot de passe mis à jour. Vous pouvez vous connecter."
      : null;

  // Destination posée par le middleware quand l'utilisateur a été intercepté.
  // Revalidée côté serveur dans loginAction — jamais suivie telle quelle.
  const nextPath = searchParams.get("next");
  const occupe = etat === "chargement" || isPending;
  const confirme = etat === "confirme";

  if (etat === "succes") {
    return <TransitionConnexion onPret={naviguer} />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <VoletPlan />

      <main className="relative flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        {/* Sur téléphone, le plan reste présent mais discret, derrière le
            formulaire, et ne prend aucune hauteur à lui seul. La grille
            SEULE : les cotes du plan complet tombaient derrière le texte et
            se lisaient comme lui. */}
        <div className="absolute inset-0 opacity-[0.35] lg:hidden">
          <PlanArchitectural pas={26} variante="grille" />
        </div>

        {/*
          LA CARTE. Le formulaire était posé à plat sur le fond : rien ne
          disait où s'arrêtait le décor et où commençait ce qu'on doit
          remplir. Le verre dépoli sépare les deux sans poser un mur — on voit
          encore le plan au travers, ce qui est tout l'objet du décor.
        */}
        <div className="relative w-full max-w-sm rounded-2xl border border-border/60 bg-background/70 p-6 shadow-[0_8px_40px_-12px_rgb(0_0_0/0.25)] backdrop-blur-xl sm:p-8">
          <div className="plan-monter flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HardHat className="h-6 w-6" aria-hidden />
            </div>
            <span className="text-lg font-bold tracking-tight">Construction iOS</span>
          </div>

          <div className="plan-monter mt-8 lg:mt-0" style={{ animationDelay: "60ms" }}>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Bon retour sur votre chantier numérique
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Vos soumissions, vos chantiers et votre facturation vous attendent.
            </p>
          </div>

          {successMessage && (
            <p
              role="status"
              className="plan-monter mt-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
            >
              {successMessage}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="plan-monter mt-8 space-y-5"
            style={{ animationDelay: "120ms" }}
            noValidate={false}
          >
            {nextPath && <input type="hidden" name="next" value={nextPath} />}

            <div className="space-y-2">
              <Label htmlFor="email">Courriel</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="vous@entreprise.com"
                required
                autoComplete="username"
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-accent-encre hover:underline"
                >
                  Mot de passe oublié?
                </Link>
              </div>
              <ChampMotDePasse
                id="password"
                name="password"
                placeholder="Votre mot de passe"
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>

            {/*
              L'ERREUR EST ANNONCÉE, pas seulement affichée : sans `role`, un
              lecteur d'écran laisse la personne devant un formulaire qui n'a
              simplement rien fait.
            */}
            {error && (
              <p
                role="alert"
                data-testid="erreur-connexion"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {error}
                  {/* Une erreur sans issue est un cul-de-sac. Celle-ci en a
                      une : renvoyer le courriel de confirmation. */}
                  {aConfirmer && (
                    <>
                      {" "}
                      <Link
                        href={`/verify-email?email=${encodeURIComponent(courriel.current)}`}
                        className="font-semibold underline underline-offset-2"
                      >
                        Renvoyer le courriel
                      </Link>
                    </>
                  )}
                </span>
              </p>
            )}

            <Button
              type="submit"
              className="group h-11 w-full text-base"
              disabled={occupe || confirme}
              aria-busy={occupe}
            >
              {confirme ? (
                <>
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                  Connexion réussie
                </>
              ) : occupe ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Connexion…
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </>
              )}
            </Button>

            {showDemo && (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <p className="text-center text-xs font-medium text-muted-foreground">
                  Compte de démonstration
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={demoLoading || isPending}
                  onClick={handleDemoLogin}
                >
                  {demoLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  Explorer la démo
                </Button>
                {process.env.NODE_ENV === "development" && (
                  <p className="text-center text-[10px] text-muted-foreground">
                    Dev seulement : admin@constructionios.com
                  </p>
                )}
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte?{" "}
              <Link href="/register" className="font-medium text-accent-encre hover:underline">
                S&apos;inscrire
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
