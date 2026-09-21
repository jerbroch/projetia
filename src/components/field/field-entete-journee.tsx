import { MotifArchitectural } from "@/components/brand/motif-architectural";
import { cn } from "@/lib/utils";

/**
 * L'EN-TÊTE DE LA JOURNÉE — « Bonjour Marc », sur le chantier.
 *
 * Même parti que le bandeau de l'accueil employeur : la référence pose la
 * salutation sur un rendu architectural. Le dépôt n'en contient pas, et je
 * ne le remplace pas par une approximation.
 *
 * FICHIER ATTENDU : `public/bandeau-chantier-mobile.webp`
 *   • 1200 × 600 px (rapport 2:1), WebP qualité 80, viser moins de 120 Ko
 *   • même immeuble que le bandeau d'ordinateur, cadré plus serré
 *   • partie gauche dégagée : la salutation s'y pose
 *
 * La page ne passe le chemin QUE si le fichier existe sur le disque : le
 * déposer suffit, il n'y a pas d'interrupteur à trouver. Sans lui, l'en-tête
 * reste un aplat pétrole avec ses lignes de plan — présentable, et qui ne
 * ment pas sur ce qu'il est.
 */
export function FieldEnteteJournee({
  salutation,
  date,
  image,
  className,
}: {
  salutation: string;
  date: string;
  /** Le rendu de l'immeuble, ancré à droite. */
  image?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative -mx-4 -mt-4 overflow-hidden bg-petrole px-4 pb-5 pt-5 text-petrole-foreground",
        className,
      )}
    >
      {image && (
        /*
          L'IMMEUBLE EST ANCRÉ À DROITE, à sa proportion naturelle, comme sur
          le bandeau de l'employeur. Image décorative déjà dimensionnée :
          `next/image` n'aurait rien à optimiser ici et ajouterait un
          chargeur.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden
          className="absolute inset-y-0 right-0 h-full w-auto max-w-[58%] object-cover object-left"
        />
      )}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          image
            ? "bg-gradient-to-r from-petrole from-42% via-petrole/85 via-64% to-petrole/25"
            : "bg-gradient-to-br from-petrole to-petrole-doux/70",
        )}
      />
      <MotifArchitectural
        className="pointer-events-none absolute bottom-0 right-0 h-full w-[58%] text-petrole-foreground opacity-[0.14]"
      />

      <div className="relative">
        <h1 className="text-[26px] font-bold leading-tight">{salutation}</h1>
        <p className="mt-0.5 text-sm text-petrole-foreground/75">{date}</p>
      </div>
    </section>
  );
}
