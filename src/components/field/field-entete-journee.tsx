import { cn } from "@/lib/utils";

/**
 * L'EN-TÊTE DE LA JOURNÉE — la salutation, sur le pétrole du chantier.
 *
 * Il prolonge l'en-tête de marque du châssis : même fond, aucune couture
 * entre les deux, comme sur la référence. Le rendu architectural est ancré
 * à droite, le texte garde le tiers gauche.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SUR L'IMAGE. `public/bandeau-chantier-mobile.webp` — 600 × 572 px, cadré
 * plus serré que la version ordinateur sur la zone où le filaire devient
 * béton. Aucun texte d'interface. À cette résolution il reste net même sur
 * un écran à trois fois la densité.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * AUCUNE PRÉSENCE N'EST AFFICHÉE. La référence montre une pastille
 * « En ligne » ; l'application ne suit pas la connexion des travailleurs, et
 * une pastille verte permanente affirmerait quelque chose de faux.
 */
export function FieldEnteteJournee({
  salutation,
  date,
  image,
  className,
}: {
  salutation: string;
  date: string;
  /** Le rendu de l'immeuble, cadrage téléphone, ancré à droite. */
  image?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative isolate -mx-4 -mt-4 overflow-hidden bg-petrole px-4 pb-6 pt-4 text-petrole-foreground",
        className,
      )}
    >
      {image && (
        /*
          L'IMMEUBLE, ANCRÉ À DROITE, à sa proportion naturelle. Image
          décorative déjà dimensionnée : `next/image` n'aurait rien à
          optimiser et ajouterait un chargeur. Les dimensions sont déclarées
          pour que la bande ne se réajuste pas à l'arrivée du fichier.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden
          width={600}
          height={572}
          decoding="async"
          className={cn(
            "absolute inset-y-0 right-0 -z-10 h-full w-auto max-w-[56%] object-cover object-[38%_45%]",
            /*
              LE BORD GAUCHE S'EFFACE. Sans masque, le découpage laisse un
              rectangle net au milieu du pétrole — on voit l'image collée,
              pas l'immeuble qui émerge du fond.
            */
            "[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_30%)]",
            "[mask-image:linear-gradient(to_right,transparent_0%,black_30%)]",
          )}
        />
      )}

      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10",
          image
            ? "bg-gradient-to-r from-petrole from-30% via-petrole/78 via-52% to-transparent"
            : "bg-gradient-to-br from-petrole to-petrole-doux/70",
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] font-extrabold leading-tight tracking-tight">
            {salutation}
          </h1>
          <p className="mt-1 text-[13px] text-petrole-foreground/75">{date}</p>
        </div>

        {/*
          LA DEVISE DU COIN DROIT A ÉTÉ RETIRÉE, ET C'EST DÉLIBÉRÉ.

          Sur la référence elle est incrustée dans l'illustration ; posée en
          vrai texte au-dessus du rendu, elle tombait sur la façade éclairée
          et devenait illisible — trois mots gris clair sur du béton blanc.
          Sur 390 px, la salutation a besoin de toute la largeur.
        */}
      </div>
    </section>
  );
}
