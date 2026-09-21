import { ReactNode } from "react";
import { ChassisNavigation } from "./chassis-navigation";
import type { Company, User } from "@/types";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  company: Company;
  user: User;
  isDemo?: boolean;
}

/**
 * L'enveloppe de l'espace connecté. Elle reste un composant serveur : tout
 * ce qui demande un état vit dans `ChassisNavigation`.
 */
export function DashboardLayout({
  children,
  title,
  description,
  company,
  user,
  isDemo,
}: DashboardLayoutProps) {
  return (
    <ChassisNavigation
      title={title}
      description={description}
      company={company}
      user={user}
      isDemo={isDemo}
    >
      {children}
    </ChassisNavigation>
  );
}
