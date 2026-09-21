"use client";

import { Bell, Building2, ChevronDown, LogOut, Menu, Search, Shield, User } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { logoutAction } from "@/lib/actions/auth";
import { getRoleLabel } from "@/lib/role-labels";
import type { Company, User as AppUser } from "@/types";

interface HeaderProps {
  title: string;
  /**
   * Acceptée pour ne rien casser chez les appelants, mais la barre ne
   * l'affiche pas : la description utile est celle de l'écran.
   */
  description?: string;
  user: AppUser;
  company: Company;
  isDemo?: boolean;
  hideSearch?: boolean;
  /** Ouvre le menu sur téléphone. Le bouton vit ici, pas par-dessus la page. */
  onOuvrirMenu?: () => void;
}

export function Header({
  title,
  user,
  company,
  isDemo,
  hideSearch,
  onOuvrirMenu,
}: HeaderProps) {
  const roleLabel = getRoleLabel(user.role);
  const initials =
    user.name
      ?.split(" ")
      .filter(Boolean)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "U";

  const accountSummary = [user.name, user.email, company.name, roleLabel].filter(Boolean).join(" / ");

  return (
    <header
      aria-label={`Barre de navigation — ${title}`}
      className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:gap-4 lg:px-6"
    >
      {/*
        Le bouton du menu occupe SA place dans l'en-tête. Il était posé en
        `fixed` par-dessus la page et recouvrait le coin supérieur gauche de
        chaque écran — le `pl-10` qui suivait était le pansement.
      */}
      {onOuvrirMenu && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ouvrir le menu"
          className="-ml-1 shrink-0 lg:hidden"
          onClick={onOuvrirMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      {/*
        LA BARRE NE PORTE PLUS LE TITRE.

        Elle affichait « Clients / Gérez vos relations clients » pendant que
        l'écran affichait « Clients / Consultez et gérez tous vos clients »
        quatre-vingts pixels plus bas. Deux titres pour une seule page, deux
        descriptions qui disaient la même chose autrement : le lecteur
        hésitait sur ce qu'il devait lire.

        Le titre appartient au contenu — c'est lui qui est le `h1`. La barre
        garde ce qui lui revient : le menu, la recherche, les avis, le compte.

        `title` reste dans l'API et sert de nom accessible à la barre : une
        personne au lecteur d'écran sait ainsi de quelle page relèvent ces
        commandes, sans qu'un second titre soit lu à voix haute.
      */}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {/*
          « Vue d'ensemble » nomme la ZONE, pas l'écran : le titre de l'écran
          est dans le contenu, et le répéter ici ramènerait le doublon qu'on a
          retiré. Sur téléphone, le nom de l'entreprise prend cette place —
          le menu bleu pétrole y est replié et emporte la seule marque.
        */}
        <span className="hidden text-sm font-medium text-muted-foreground lg:inline">
          Vue d&apos;ensemble
        </span>
        <span className="truncate text-sm font-semibold tracking-tight lg:hidden">
          {company.name}
        </span>
        {isDemo && (
          <span className="shrink-0 rounded-full bg-attente/10 px-2 py-0.5 text-xs font-medium text-attente">
            Démo
          </span>
        )}
      </div>

      {/* La recherche prend le centre et respire : c'est la commande la plus
          utilisée de la barre. */}
      {!hideSearch ? (
        <div className="hidden flex-1 justify-center px-4 md:flex">
          <div className="relative w-full max-w-xl">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Rechercher"
              placeholder="Rechercher un client, une soumission, une facture..."
              className="h-10 rounded-full border-border/80 pl-10 sm:h-10"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        className="relative shrink-0"
      >
        <Bell className="h-[18px] w-[18px]" />
        {/*
          LA PASTILLE DE LA RÉFÉRENCE. Elle ne s'allume pas toute seule : il
          n'existe pas encore de notifications côté employeur, et une pastille
          permanente apprendrait à l'ignorer. Elle attend son signal.
        */}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-label={`Compte — ${accountSummary}`}
            className="h-auto min-w-0 max-w-[18rem] shrink gap-2 px-1.5 py-1.5 sm:px-2"
          >
            {/*
              L'EN-TÊTE NE PORTE PLUS QUE L'AVATAR.

              Le nom, le courriel et l'entreprise s'affichaient ici en toutes
              lettres — 388 px qui poussaient la page hors de l'écran à 768 px.
              Depuis que le compte a sa place en bas du menu, les répéter dans
              la barre était doublement inutile. Ils restent dans le menu
              déroulant, à un clic, et dans le nom accessible du bouton.
            */}
            {/*
              L'AVATAR EST PÉTROLE, pas orange pâle : c'est la composition de
              la référence, et l'orange reste réservé aux actions.
            */}
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-petrole text-[13px] font-semibold text-petrole-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                {company.name} · {roleLabel}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <User className="mr-2 h-4 w-4" />
              Mon profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Building2 className="mr-2 h-4 w-4" />
              Entreprise
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="opacity-100">
            <Shield className="mr-2 h-4 w-4" />
            Rôle : {roleLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={logoutAction} className="w-full">
            <DropdownMenuItem asChild>
              <button type="submit" className="flex w-full cursor-default items-center">
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
