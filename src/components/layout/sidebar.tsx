"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ClipboardCheck,
  CreditCard,
  FileText,
  HardHat,
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
import type { Company } from "@/types";

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
  isDemo?: boolean;
  /** L'état vit dans le châssis : l'en-tête porte le bouton d'ouverture. */
  ouvert: boolean;
  onOuvrir: () => void;
  onFermer: () => void;
}

export function Sidebar({ company, isDemo, ouvert, onOuvrir, onFermer }: SidebarProps) {
  const pathname = usePathname();
  const mobileOpen = ouvert;
  const setMobileOpen = (v: boolean) => (v ? onOuvrir() : onFermer());

  const navContent = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={company.name} className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            style={{ backgroundColor: company.primaryColor ?? undefined }}
          >
            <HardHat className="h-[18px] w-[18px]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-petrole-foreground">
            {company.name}
          </span>
          {isDemo && (
            <span className="block truncate text-[10px] text-primary">
              Compte de démonstration
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fermer le menu"
          className="ml-auto text-petrole-foreground hover:bg-white/10 hover:text-petrole-foreground lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                /*
                 * LA SECTION ACTIVE SE VOIT SANS QU'ON LA CHERCHE : un trait
                 * orange à gauche, un fond plus clair, une encre franche. Un
                 * simple changement de teinte du texte, sur fond sombre, se
                 * perd — et on ne sait plus où on est.
                 *
                 * 44 px de haut : c'est le menu qu'on manipule au pouce.
                 */
                "relative flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm font-medium",
                "transition-colors duration-normal motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-petrole",
                "lg:min-h-0 lg:py-2",
                isActive
                  ? "bg-white/[0.09] text-petrole-foreground"
                  : "text-petrole-foreground/65 hover:bg-white/[0.05] hover:text-petrole-foreground",
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary"
                />
              )}
              <item.icon
                className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-primary")}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/*
        UN DESSIN DE PLAN, TOUT EN BAS ET TOUT EN RETRAIT.

        Il occupe l'espace vide sous le menu plutôt que de border le texte :
        un motif qui monte derrière les libellés les rend plus difficiles à
        lire sans rien apporter. `aria-hidden`, et la hauteur est fixe pour
        qu'il ne pousse jamais la navigation hors de l'écran.
      */}
      <div aria-hidden className="pointer-events-none relative h-28 shrink-0 overflow-hidden">
        <svg
          className="absolute inset-x-0 bottom-0 h-full w-full opacity-[0.13]"
          viewBox="0 0 256 112"
          fill="none"
          preserveAspectRatio="xMidYMax slice"
        >
          <g stroke="hsl(var(--petrole-foreground))" strokeWidth="1">
            <path d="M24 104 V54 H86 V30 H150 V104" />
            <path d="M86 54 H150" />
            <path d="M118 54 V104" />
            <path d="M178 104 V66 H232 V104" />
            <path d="M178 84 H232" />
          </g>
          <g stroke="hsl(var(--primary))" strokeWidth="2.5">
            <path d="M96 104 H128" />
            <path d="M196 66 V84" />
          </g>
          <g stroke="hsl(var(--petrole-foreground))" strokeWidth="0.5" opacity="0.7">
            <path d="M24 110 H150" />
            <path d="M24 107 V113 M150 107 V113" />
          </g>
        </svg>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-petrole/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col bg-petrole",
          "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]",
          "transition-transform duration-ample motion-reduce:transition-none lg:hidden",
          mobileOpen ? "translate-x-0 shadow-flottant" : "-translate-x-full",
        )}
      >
        {navContent}
      </aside>

      <aside className="hidden w-64 shrink-0 flex-col bg-petrole lg:flex">{navContent}</aside>
    </>
  );
}
