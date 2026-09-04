"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LogOut, CalendarDays, Hammer, Wrench, Phone} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { Company, User } from "@/types";

const NAV_ITEMS = [
  { href: "/terrain", label: "Aujourd'hui", icon: Hammer, exact: true },
  { href: "/terrain/horaire", label: "Mon horaire", icon: CalendarDays },
  { href: "/terrain/outils", label: "Mes outils", icon: Wrench },
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
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{company.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.name}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground"
              aria-label="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
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
        className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {/*
          Le nombre de colonnes SUIT le nombre d'onglets. Écrire `grid-cols-3`
          à côté d'une liste de quatre éléments est une contradiction qui ne se
          voit qu'à l'écran, sur un téléphone étroit.
        */}
        <div
          className="mx-auto grid max-w-lg gap-1 px-2 py-2"
          style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl px-2 py-2 text-xs font-medium",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="mb-1 h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
