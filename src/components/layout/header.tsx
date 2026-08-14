"use client";

import { Bell, Building2, LogOut, Search, Shield, User } from "lucide-react";
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
  description?: string;
  user: AppUser;
  company: Company;
  isDemo?: boolean;
  hideSearch?: boolean;
}

export function Header({ title, description, user, company, isDemo, hideSearch }: HeaderProps) {
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      <div className="flex-1 pl-10 lg:pl-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold lg:text-xl">{title}</h1>
          {isDemo && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Démo
            </span>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
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
            className="h-auto max-w-[min(100vw-8rem,28rem)] shrink gap-2 px-2 py-1.5"
          >
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground" title={accountSummary}>
                {user.email} · {company.name} · {roleLabel}
              </p>
            </div>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
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
