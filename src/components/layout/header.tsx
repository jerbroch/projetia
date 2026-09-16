"use client";

import { Bell, Building2, LogOut, Menu, Search, Shield, User } from "lucide-react";
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
   * Conservée dans l'API pour ne rien casser chez les appelants, mais la
   * barre ne l'affiche plus : la description utile est celle de l'écran.
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
  description: _description,
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
      <div className="min-w-0 flex-1">
        {isDemo && (
          <span className="rounded-full bg-attente/10 px-2 py-0.5 text-xs font-medium text-attente">
            Démo
          </span>
        )}
      </div>

      {!hideSearch && (
        <div className="hidden items-center gap-2 md:flex">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Rechercher..." className="w-64 pl-8" />
          </div>
        </div>
      )}

      <Button variant="ghost" size="icon" className="relative shrink-0">
        <Bell className="h-4 w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-label={`Compte — ${accountSummary}`}
            className="h-auto min-w-0 max-w-[18rem] shrink gap-2 px-1.5 py-1.5 sm:px-2"
          >
            {/*
              LE DÉTAIL DU COMPTE N'APPARAÎT QU'À PARTIR DE 1280 px.

              Il s'affichait dès 640 px : à 768 px, ce bloc faisait 388 px à
              lui seul et poussait la page à 848 px de large. Douze écrans sur
              treize débordaient horizontalement à cette largeur — sans que
              rien ne se voie sur un téléphone ni sur un grand écran, où la
              place existe. Le nom et le courriel restent lisibles dans le
              menu déroulant, qui les répète.
            */}
            <div className="hidden min-w-0 text-right xl:block">
              <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground" title={accountSummary}>
                {user.email} · {company.name} · {roleLabel}
              </p>
            </div>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-accent-encre">{initials}</AvatarFallback>
            </Avatar>
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
