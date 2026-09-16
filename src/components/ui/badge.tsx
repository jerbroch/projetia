import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        /*
         * STATUTS SOBRES : un fond très pâle, une encre foncée mesurée
         * au-dessus de 4,5 sur carte blanche, et JAMAIS l'orange — il est
         * réservé aux actions, et le voir sur un statut ferait croire
         * qu'il y a quelque chose à cliquer.
         */
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-danger/10 text-danger",
        outline: "border-border text-foreground",
        success: "border-transparent bg-succes/10 text-succes",
        warning: "border-transparent bg-attente/10 text-attente",
        info: "border-transparent bg-info/10 text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
