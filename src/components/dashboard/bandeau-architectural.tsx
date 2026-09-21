import Link from "next/link";
import { ArrowRight, CalendarPlus } from "lucide-react";
import { MotifArchitectural } from "@/components/brand/motif-architectural";
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
 * SUR L'IMAGE, ET SANS EMBELLISSEMENT.
 *
 * `public/bandeau-chantier.webp` est un DÉCOUPAGE de la maquette de
 * référence — 445 × 216 px. Il ne contient ni texte d'interface ni bouton :
 * la zone a été choisie entre les deux blocs de texte incrustés. Mais à
 * cette taille il est affiché autour de 1,4× sur un écran ordinaire, et
 * 2,8× sur un écran haute densité. CE N'EST PAS UN ASSET DÉFINITIF.
 *
 * Le fichier attendu, aux mêmes cadrage et composition :
 *
 *   `public/bandeau-chantier.webp`        1600 × 560 px  (≈ 2,9:1)
 *   `public/bandeau-chantier-mobile.webp`  900 × 700 px  (≈ 1,3:1)
 *
 * Le déposer sous le même nom suffit : aucune ligne de code à changer.
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

/** Les verbes de la référence, en colonne, très en retrait. */
const VERBES = ["Planifier", "Coordonner", "Réaliser", "Bâtir plus loin"];

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
        "min-h-[168px] sm:min-h-[188px] lg:min-h-[208px]",
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
            width={445}
            height={216}
            decoding="async"
            className={cn(
              "absolute inset-y-0 right-0 -z-10 h-full w-auto object-cover object-left",
              "max-w-[46%] sm:max-w-[56%] lg:max-w-[52%]",
              /*
                LE BORD GAUCHE DE L'IMAGE S'EFFACE.

                Le dégradé posé PAR-DESSUS laissait encore une arête nette :
                il s'éclaircit progressivement, l'image commence d'un coup.
                Un masque sur l'image elle-même règle la jointure à la
                source — l'immeuble naît du pétrole au lieu d'y être collé.
              */
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
            ? "bg-gradient-to-r from-petrole-sombre from-30% via-petrole-sombre/70 via-52% to-transparent"
            : "bg-gradient-to-r from-petrole-sombre to-petrole",
        )}
      />

      {/* Les lignes de plan, entre le texte et le rendu. */}
      <MotifArchitectural
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[30%] -z-10 hidden h-full w-[34%] text-petrole-foreground opacity-[0.22] md:block"
      />

      <div className="relative flex h-full items-center gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
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
          Les verbes, masqués sous `lg` : sur un écran étroit ils mangeraient
          la largeur du titre pour quatre mots qui n'appellent aucune action.
        */}
        <ul aria-hidden className="hidden shrink-0 space-y-2 lg:block">
          {VERBES.map((mot) => (
            <li
              key={mot}
              className="text-[10px] font-semibold uppercase tracking-[0.16em] text-petrole-foreground/45"
            >
              {mot}
            </li>
          ))}
        </ul>
      </div>

      {/*
        La mention du coin droit, comme sur la référence — en VRAI texte,
        pas incrustée dans l'image : elle reste sélectionnable, traduisible,
        et suit la taille de police du système.
      */}
      <p
        aria-hidden
        className="absolute right-6 top-7 hidden w-[7rem] text-[9px] font-semibold uppercase leading-[1.9] tracking-[0.18em] text-petrole-foreground/55 xl:block"
      >
        Des projets qui bâtissent demain
        <span className="mt-2 block h-px w-8 bg-primary" />
      </p>
    </section>
  );
}
