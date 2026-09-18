"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CalendarDays, Home, LogOut, Phone, Wrench } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { MarqueConstructionIos } from "@/components/brand/marque-construction-ios";
import { cn } from "@/lib/utils";
import type { Company, User } from "@/types";

/**
 * LE CHÂSSIS DE L'ESPACE TRAVAILLEUR.
 *
 * Un homme sur un chantier tient son téléphone d'une main, souvent avec des
 * gants, parfois au soleil. Tout ici en découle : une bande pétrole qui dit
 * chez qui il travaille, des cartes blanches à fort contraste, et quatre
 * onglets au pouce.
 *
 * LA LARGEUR RESTE ÉTROITE, MÊME SUR ORDINATEUR. Ce n'est pas un oubli :
 * étaler ces écrans sur 1400 px en ferait un tableau de bord administratif,
 * alors que c'est un outil de poche qu'on consulte aussi depuis un bureau.
 */

const NAV_ITEMS = [
  { href: "/terrain", label: "Aujourd'hui", icon: Home, exact: true },
  { href: "/terrain/horaire", label: "Horaire", icon: CalendarDays },
  { href: "/terrain/outils", label: "Outils", icon: Wrench },
  // Joindre SON employeur, pas nous. Dans la barre du bas, comme le reste :
  // sur un chantier, on ne fouille pas dans des menus.
  { href: "/terrain/aide", label: "Joindre", icon: Phone },
];

interface FieldLayoutProps {
  children: React.ReactNode;
  company: Company;
  user: User;
}

export function FieldLayout({ children, company, user }: FieldLayoutProps) {
  const pathname = usePathname();
  const barre = useRef<HTMLElement>(null);

  // La hauteur réelle, mesurée. Elle change avec la taille du texte du
  // téléphone, que l'ouvrier a souvent grossie.
  useEffect(() => {
    const nav = barre.current;
    if (!nav) return;
    const mesurer = () =>
      document.documentElement.style.setProperty("--hauteur-barre", `${nav.offsetHeight}px`);
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(nav);
    return () => observateur.disconnect();
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-secondary/40">
      {/* ───────── La bande pétrole : chez qui je travaille ───────── */}
      <header className="sticky top-0 z-20 bg-petrole pt-[env(safe-area-inset-top)] text-petrole-foreground">
        <div className="flex items-center gap-3 px-4 py-3">
          {company.logoUrl ? (
            /* Le logo de SON employeur passe avant notre marque. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-7 w-7 shrink-0 rounded-md object-cover"
            />
          ) : (
            <MarqueConstructionIos className="shrink-0 text-primary" taille={26} />
          )}
          <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{company.name}</p>

          {/*
            La déconnexion, et rien d'autre. La maquette montre une cloche ;
            il n'existe aucune notification pour le terrain, et une cloche qui
            n'ouvre rien apprend à ignorer les cloches.
          */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-petrole-foreground/80 transition-colors duration-normal hover:bg-white/10 hover:text-petrole-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
              aria-label={`Se déconnecter — ${user.name}`}
              title="Se déconnecter"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </form>
        </div>
      </header>

      {/*
        LA MARGE DU BAS SE CALCULE SUR LA BARRE, elle n'est pas écrite en dur.
        Elle valait `pb-24` (96 px) pour une barre d'une rangée. Le quatrième
        onglet a fait passer la barre à deux rangées et 133 px : le bas des
        cartes est passé dessous, sans que rien ne le signale.

        `--hauteur-barre` est posée par la barre elle-même, ci-dessous. Un
        cinquième onglet un jour ne reproduira donc pas le défaut en silence.
      */}
      <main
        className="flex-1 px-4 py-4"
        style={{ paddingBottom: "calc(var(--hauteur-barre, 5rem) + 1rem)" }}
      >
        {children}
      </main>

      <nav
        ref={barre}
        aria-label="Navigation principale"
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {/*
          Le nombre de colonnes SUIT le nombre d'onglets. Écrire `grid-cols-3`
          à côté d'une liste de quatre éléments est une contradiction qui ne se
          voit qu'à l'écran, sur un téléphone étroit.
        */}
        <div
          className="mx-auto grid max-w-lg gap-1 px-2 py-1.5"
          style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // 44 px de haut au minimum : la cible qu'un pouce atteint
                  // sans viser, gants compris.
                  "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5",
                  "text-[11px] font-medium leading-tight",
                  "transition-colors duration-normal motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-1",
                  active ? "bg-petrole/[0.08] text-petrole" : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn("h-[22px] w-[22px] shrink-0", active && "text-petrole")}
                  aria-hidden
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
