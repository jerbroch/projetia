import { MotifArchitectural } from "@/components/brand/motif-architectural";
import { cn } from "@/lib/utils";

/**
 * LE BANDEAU DE L'ACCUEIL — « Une équipe. Une vue d'ensemble. »
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI MANQUE, ET QUE JE NE PRÉTENDS PAS AVOIR REPRODUIT.
 *
 * La référence superpose deux choses : un RENDU ARCHITECTURAL RÉALISTE d'un
 * immeuble, et des lignes de plan par-dessus. Le dépôt ne contient aucune
 * image de ce genre — `public/` ne porte que le logo Stripe, et les
 * composants de marque sont des tracés SVG.
 *
 * On ne fabrique pas un rendu photoréaliste avec des primitives SVG. Trois
 * cubes en dégradé ne seraient pas « presque » l'image demandée : ce serait
 * une autre image, moins bonne, présentée comme la bonne.
 *
 * Ce composant est donc construit pour ACCUEILLIR le fichier :
 *   • s'il est présent, il occupe le bandeau et les lignes passent dessus ;
 *   • s'il manque, le bandeau reste un aplat pétrole tenu par sa typographie
 *     et son motif au trait — présentable, et honnête sur ce qu'il est.
 *
 * FICHIER ATTENDU : `public/bandeau-chantier.webp`
 *   • 2400 × 900 px (rapport 8:3), pour rester net sur un écran dense
 *   • WebP de qualité 82, viser moins de 250 Ko
 *   • sujet : immeuble en construction vu de trois quarts, cadré à droite,
 *     tiers gauche dégagé pour que le texte reste lisible
 *   • lumière froide, dominante bleutée, pour se marier au pétrole #102D3B
 *   • prévoir `public/bandeau-chantier@1x.webp` en 1200 × 450 px pour les
 *     téléphones, sinon on impose 250 Ko à une connexion de chantier
 * ─────────────────────────────────────────────────────────────────────────
 */

interface BandeauArchitecturalProps {
  titre: string;
  sousTitre: string;
  /** Chemin public du rendu. Absent : le bandeau tient sans lui. */
  image?: string;
  className?: string;
}

/** Les trois mots de la colonne de droite, comme sur la référence. */
const DEVISE = ["Planifier", "Bâtir", "Avancer"];

export function BandeauArchitectural({
  titre,
  sousTitre,
  image,
  className,
}: BandeauArchitecturalProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl bg-petrole text-petrole-foreground",
        // Plus bas tant que le rendu manque : un grand aplat vide se
        // remarque, alors qu'une bande tenue par sa typographie ne se
        // remarque pas. L'image, quand elle arrivera, mérite la hauteur.
        image
          ? "min-h-[168px] sm:min-h-[200px] lg:min-h-[232px]"
          : "min-h-[140px] sm:min-h-[156px] lg:min-h-[172px]",
        className,
      )}
    >
      {image && (
        /*
          L'image est POSÉE, pas étirée : `object-cover` avec un cadrage à
          droite garde l'immeuble entier et laisse le texte sur la partie
          calme. `aria-hidden` — elle n'ajoute rien qu'un lecteur d'écran
          doive entendre, le titre dit déjà tout.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
      )}

      {/*
        LE VOILE QUI REND LE TEXTE LISIBLE.

        Sans lui, un titre blanc posé sur une façade claire devient illisible
        dès que l'image change. Le dégradé part du pétrole plein à gauche et
        s'efface vers la droite : le texte garde son fond, l'immeuble garde sa
        lumière.
      */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          image
            ? "bg-gradient-to-r from-petrole via-petrole/85 to-petrole/25"
            : "bg-gradient-to-r from-petrole to-petrole-doux/60",
        )}
      />

      {/* Les lignes de plan, par-dessus. C'est la moitié que nous avons. */}
      <MotifArchitectural
        className="pointer-events-none absolute bottom-0 right-0 h-full w-[62%] text-petrole-foreground opacity-[0.16]"
      />

      <div className="relative flex h-full items-center gap-6 px-5 py-6 sm:px-7 sm:py-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-balance text-xl font-bold leading-tight sm:text-2xl lg:text-[1.75rem]">
            {titre}
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-petrole-foreground/75 sm:text-base">
            {sousTitre}
          </p>
          <span
            aria-hidden
            className="mt-4 block h-px w-16 bg-petrole-foreground/30"
          />
        </div>

        {/*
          La devise en colonne, très en retrait. Masquée sous `lg` : sur un
          écran étroit elle mangerait la largeur du titre pour trois mots qui
          n'apportent rien d'actionnable.
        */}
        <ul
          aria-hidden
          className="hidden shrink-0 space-y-1.5 border-l border-petrole-foreground/20 pl-5 lg:block"
        >
          {DEVISE.map((mot) => (
            <li
              key={mot}
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-petrole-foreground/55"
            >
              {mot}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
