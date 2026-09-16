import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  /** L'icône du domaine plutôt que la boîte générique, quand elle existe. */
  icon?: LucideIcon;
  /** L'action qui sort de l'écran vide. */
  action?: ReactNode;
}

/**
 * L'ÉCRAN VIDE. Il dit ce qui manque, et comment le remplir.
 *
 * Le contour en pointillé sur fond ivoire rend l'absence explicite : sans
 * lui, une zone vide se lit comme un chargement qui n'a pas abouti. Les
 * 48 px de marge remplacent les 96 px d'avant — un écran vide n'a pas
 * besoin d'occuper toute la hauteur pour se faire comprendre, surtout sur
 * un téléphone où il poussait tout le reste sous la ligne de flottaison.
 */
export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center sm:py-12">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
      <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
