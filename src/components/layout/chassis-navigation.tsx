"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { Company, User } from "@/types";

/**
 * LE CHÂSSIS : le menu, l'en-tête, et l'état qu'ils partagent.
 *
 * Le bouton du menu vivait dans le menu, en `fixed left-4 top-4` : il
 * flottait par-dessus la page et recouvrait le coin supérieur gauche de
 * chaque écran. Le mettre dans l'en-tête demande que les deux partagent
 * l'état d'ouverture — c'est tout ce que ce composant fait.
 *
 * Il est client parce qu'un état l'exige ; les pages qui l'utilisent
 * restent des composants serveur et lui passent leurs données.
 */
export interface ChassisNavigationProps {
  children: ReactNode;
  title: string;
  description?: string;
  company: Company;
  user: User;
  isDemo?: boolean;
  hideHeaderSearch?: boolean;
}

export function ChassisNavigation({
  children,
  title,
  description,
  company,
  user,
  isDemo,
  hideHeaderSearch,
}: ChassisNavigationProps) {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        company={company}
        user={user}
        isDemo={isDemo}
        ouvert={menuOuvert}
        onOuvrir={() => setMenuOuvert(true)}
        onFermer={() => setMenuOuvert(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={title}
          description={description}
          user={user}
          company={company}
          isDemo={isDemo}
          hideSearch={hideHeaderSearch}
          onOuvrirMenu={() => setMenuOuvert(true)}
        />
        {/*
          `pb` tient compte de la zone de sécurité du téléphone : sans elle,
          le dernier bouton d'un écran se retrouve sous la barre d'accueil de
          l'iPhone, atteignable seulement en tirant la page.
        */}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
