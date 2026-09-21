import Link from "next/link";
import { ArrowRight, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LE BANDEAU DE L'ACCUEIL — la bande sombre de la référence.
 *
 * Composition, de gauche à droite : le titre en deux lignes, le sous-titre,
 * le bouton orange, une colonne de verbes très en retrait, puis le rendu
 * architectural collé au bord droit. Les lignes de plan passent entre les
 * deux et font la jointure.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'IMAGE PORTE LE FILAIRE, ET C'EST ELLE QUI FAIT LA TRANSITION.
 *
 * `public/bandeau-chantier.webp` — 958 × 572 px, découpé de la référence
 * fournie, sans aucun texte d'interface ni bouton. Le dessin de structure s'y
 * dissout dans le béton de gauche à droite : le plan devient le bâtiment.
 *
 * IL N'Y A DONC PLUS DE TRACÉ SVG PAR-DESSUS. Un second filaire posé sur
 * celui-ci ne se lirait pas comme de la profondeur, mais comme du bruit.
 *
 * Le bord gauche de l'image est effacé par un masque : elle naît du pétrole
 * au lieu d'y être collée, et le titre garde un fond uni.
 * ─────────────────────────────────────────────────────────────────────────
 */

interface BandeauArchitecturalProps {
  titre: string;
  sousTitre: string;
  /** Rendu large, ancré à droite. Absent : le bandeau tient sans lui. */
  image?: string;
  /** Cadrage plus serré pour les petits écrans. */
  imageMobile?: string;
  /** L'action principale de la journée, reliée à un parcours réel. */
  action?: { libelle: string; href: string };
  className?: string;
}

export function BandeauArchitectural({
  titre,
  sousTitre,
  image,
  imageMobile,
  action,
  className,
}: BandeauArchitecturalProps) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-xl bg-petrole-sombre text-petrole-foreground",
        // Hauteur contenue : le bandeau ne doit pas repousser les compteurs
        // hors de l'écran sur un portable de 800 px de haut.
        "min-h-[184px] sm:min-h-[212px] lg:min-h-[236px]",
        className,
      )}
    >
      {image && (
        /*
          UN CADRAGE PAR FORMAT. Le rendu large est ancré à droite et garde
          sa proportion ; sous 640 px, le cadrage serré prend le relais et
          n'occupe que le tiers droit, sinon le titre n'a plus de place.

          `width`/`height` sont déclarés : sans eux, la bande se réajuste à
          l'arrivée de l'image et pousse la page d'un cran.

          Image décorative déjà dimensionnée — `next/image` n'aurait rien à
          optimiser ici et ajouterait un chargeur.
        */
        <picture>
          {imageMobile && <source media="(max-width: 639px)" srcSet={imageMobile} />}
          <img
            src={image}
            alt=""
            aria-hidden
            width={958}
            height={572}
            decoding="async"
            className={cn(
              "absolute inset-0 -z-10 h-full w-full object-cover",
              /*
                LE CADRAGE EST BIAISÉ À DROITE ET VERS LE HAUT : c'est là que
                vivent la façade, la grue et la ligne d'horizon. Centré, le
                bandeau n'aurait montré que des dalles.
              */
              "object-[74%_44%] sm:object-[64%_46%] lg:object-[58%_48%]",
              /* Le bord gauche s'efface : l'image naît du pétrole. */
              "[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_26%)]",
              "[mask-image:linear-gradient(to_right,transparent_0%,black_26%)]",
            )}
          />
        </picture>
      )}

      {/*
        LE VOILE. Il part du pétrole plein à gauche et s'efface vers la
        droite : le texte garde son fond, l'immeuble garde sa lumière, et
        l'arête de découpe tombe dans la partie encore opaque.
      */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10",
          image
            ? "bg-gradient-to-r from-petrole-sombre from-18% via-petrole-sombre/72 via-38% to-transparent"
            : "bg-gradient-to-r from-petrole-sombre to-petrole",
        )}
      />

      <div className="relative flex h-full items-center px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
        <div className="min-w-0 max-w-[30rem] flex-1">
          <h1 className="text-balance text-[1.375rem] font-extrabold leading-[1.15] tracking-tight sm:text-[1.625rem] lg:text-[1.875rem]">
            {titre}
          </h1>
          <p className="mt-2 text-sm leading-snug text-petrole-foreground/80 sm:text-[0.9375rem]">
            {sousTitre}
          </p>

          {action && (
            <Link
              href={action.href}
              className={cn(
                "mt-4 inline-flex min-h-[44px] items-center gap-2.5 rounded-[10px] bg-primary px-4 text-[0.9375rem] font-bold text-primary-foreground sm:px-5",
                "transition-colors duration-normal hover:bg-primary/90 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-petrole-sombre",
              )}
            >
              <CalendarPlus className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {action.libelle}
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          )}
        </div>

        {/*
          LA COLONNE DE VERBES A ÉTÉ RETIRÉE.

          Quatre mots en capitales de 11 px posés au milieu de l'ossature :
          ni le texte ni le dessin n'y survivaient. Le plan occupe cette
          bande, et il dit « planifier, coordonner, réaliser » mieux que les
          mots eux-mêmes.
        */}
      </div>

      {/*
        LA MENTION DU COIN DROIT A ÉTÉ RETIRÉE.

        Neuf pixels en capitales espacées posées sur une façade éclairée :
        personne ne la lisait, et elle salissait le rendu. Le plan
        axonométrique occupe cette zone bien mieux qu'un texte qu'il faut
        deviner.
      */}
    </section>
  );
}
