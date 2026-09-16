"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  Archive,
  Settings,
  Users,
  UserCircle,
  Wrench,
  Clock,
  X,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MarqueConstructionIos } from "@/components/brand/marque-construction-ios";
import { MotifArchitectural } from "@/components/brand/motif-architectural";
import type { Company, User } from "@/types";

/**
 * LE MENU — bleu pétrole, du logo en haut au compte en bas.
 *
 * TOUTES LES ENTRÉES RESTENT, y compris « Nous joindre », absente de la
 * maquette. Une maquette montre une composition, pas un inventaire : en
 * retirer une entrée parce qu'elle n'y figure pas reviendrait à supprimer une
 * fonction pour des raisons de dessin.
 *
 * Le compte descend en bas du menu, là où la maquette le place. Il reste dans
 * l'en-tête sur téléphone, où le menu est replié et où il serait autrement
 * inatteignable sans l'ouvrir.
 */
const navigation = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/customers", icon: Users },
  { name: "Soumissions", href: "/quotes", icon: FileText },
  { name: "À vérifier", href: "/reviews", icon: ClipboardCheck },
  { name: "Factures", href: "/invoices", icon: Receipt },
  { name: "Calendrier", href: "/schedule", icon: Calendar },
  { name: "Archives", href: "/archives", icon: Archive },
  { name: "Employés", href: "/employees", icon: UserCircle },
  { name: "Heures", href: "/heures", icon: Clock },
  { name: "Outillage", href: "/outillage", icon: Wrench },
  { name: "Paiements", href: "/payments", icon: CreditCard },
  { name: "Paramètres", href: "/settings", icon: Settings },
  // Dans le menu principal, pas dans les réglages : un entrepreneur bloqué un
  // mardi matin ne pense pas à fouiller les paramètres pour trouver un numéro.
  { name: "Nous joindre", href: "/aide", icon: LifeBuoy },
];

interface SidebarProps {
  company: Company;
  user: User;
  isDemo?: boolean;
  /** L'état vit dans le châssis : l'en-tête porte le bouton d'ouverture. */
  ouvert: boolean;
  onOuvrir: () => void;
  onFermer: () => void;
}

function initiales(nom: string | undefined | null): string {
  return (
    (nom ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((m) => m[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function Sidebar({ company, user, isDemo, ouvert, onFermer }: SidebarProps) {
  const pathname = usePathname();

  const contenu = (
    <>
      {/* ───────── L'identité, et l'entreprise active ───────── */}
      <div className="shrink-0 px-5 pt-5">
        <Link
          href="/dashboard"
          onClick={onFermer}
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-petrole"
        >
          {company.logoUrl ? (
            /* Le logo personnalisé passe avant la marque : c'est l'entreprise
               du client qui doit se reconnaître ici. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <MarqueConstructionIos className="text-primary" taille={30} />
          )}
          <span className="truncate text-[1.0625rem] font-bold tracking-tight text-petrole-foreground">
            Construction iOS
          </span>
        </Link>

        {/*
          L'ENTREPRISE ACTIVE, sous la marque. Elle mène aux Paramètres, où on
          la modifie — le chevron annonce qu'il y a quelque chose derrière, et
          il y a vraiment quelque chose derrière.
        */}
        <Link
          href="/settings"
          onClick={onFermer}
          className="mt-2.5 flex w-full items-center gap-1.5 rounded-md py-1 text-sm text-petrole-foreground/70 transition-colors duration-normal hover:text-petrole-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-petrole motion-reduce:transition-none"
        >
          <span className="truncate">{company.name}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </Link>

        {isDemo && (
          <span className="mt-2 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            Compte de démonstration
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Fermer le menu"
        className="absolute right-3 top-3 text-petrole-foreground hover:bg-white/10 hover:text-petrole-foreground lg:hidden"
        onClick={onFermer}
      >
        <X className="h-5 w-5" />
      </Button>

      {/* ───────── La navigation ───────── */}
      <nav className="mt-5 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {navigation.map((item) => {
          const actif = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onFermer}
              aria-current={actif ? "page" : undefined}
              className={cn(
                /*
                 * LA SECTION ACTIVE SE VOIT SANS QU'ON LA CHERCHE : un trait
                 * orange à gauche, un fond légèrement éclairci, une encre
                 * franche. Sur fond sombre, un simple changement de teinte du
                 * texte se perd et on ne sait plus où l'on est.
                 *
                 * 44 px de haut au doigt, resserré dès qu'il y a une souris.
                 */
                "relative flex min-h-[44px] items-center gap-3 rounded-md px-3 text-[0.9375rem]",
                "transition-colors duration-normal motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-petrole",
                "lg:min-h-0 lg:py-2.5",
                actif
                  ? "bg-white/[0.08] font-semibold text-petrole-foreground"
                  : "font-medium text-petrole-foreground/60 hover:bg-white/[0.04] hover:text-petrole-foreground",
              )}
            >
              {actif && (
                <span
                  aria-hidden
                  className="absolute inset-y-[7px] -left-3 w-[3px] rounded-r-full bg-primary"
                />
              )}
              <item.icon
                className={cn("h-[18px] w-[18px] shrink-0", actif && "text-primary")}
                aria-hidden
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* ───────── Le motif, et la devise ───────── */}
      <div aria-hidden className="pointer-events-none relative h-40 shrink-0 overflow-hidden">
        {/* Le motif part de la DROITE : à gauche, ses traits passaient sous la
            devise et la rendaient illisible. */}
        <MotifArchitectural className="absolute bottom-0 right-0 h-full w-[78%] text-petrole-foreground opacity-[0.18]" />
        <p className="absolute bottom-5 left-5 text-[9px] font-medium uppercase leading-[1.8] tracking-[0.16em] text-petrole-foreground/40">
          Bâtir aujourd&apos;hui
          <br />
          un meilleur
          <br />
          demain
        </p>
      </div>

      {/* ───────── Le compte ───────── */}
      <Link
        href="/settings"
        onClick={onFermer}
        className="flex shrink-0 items-center gap-3 border-t border-white/10 px-5 py-3.5 transition-colors duration-normal hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-petrole-foreground">
          {initiales(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-petrole-foreground">
            {user.name}
          </span>
          <span className="block truncate text-xs text-petrole-foreground/55">Mon compte</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-petrole-foreground/45" aria-hidden />
      </Link>
    </>
  );

  return (
    <>
      {ouvert && (
        <div
          className="fixed inset-0 z-40 bg-petrole/60 backdrop-blur-[2px] lg:hidden"
          onClick={onFermer}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col bg-petrole",
          "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]",
          "transition-transform duration-ample motion-reduce:transition-none lg:hidden",
          ouvert ? "translate-x-0 shadow-flottant" : "-translate-x-full",
        )}
      >
        {contenu}
      </aside>

      <aside className="hidden w-[17.5rem] shrink-0 flex-col bg-petrole lg:flex">{contenu}</aside>
    </>
  );
}
