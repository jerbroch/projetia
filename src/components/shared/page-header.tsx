import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * L'en-tête d'un écran : ce qu'on regarde, et l'action principale.
 *
 * `min-w-0` et `text-balance` : sans eux, un titre long pousse l'action
 * hors de l'écran sur téléphone au lieu de passer à la ligne.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h2 className="text-balance text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface PageActionProps {
  label: string;
  onClick?: () => void;
}

export function PageAction({ label }: PageActionProps) {
  return <Button>{label}</Button>;
}
