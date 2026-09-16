import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * LE BOUTON, ET SES SEPT ÉTATS.
 *
 * Normal, survol, pression, focus clavier, désactivé — plus le
 * chargement et le succès, que les écrans portent eux-mêmes. La pression
 * (`active:`) manquait : un bouton qui ne s'enfonce pas laisse douter
 * que le doigt a porté, et sur un chantier on retape.
 *
 * LES ZONES TACTILES FONT 44 px SUR TÉLÉPHONE et se resserrent à partir
 * de `sm`. Un pouce ganté ne vise pas 36 px.
 *
 * `motion-reduce:transition-none` : les transitions sont un confort, pas
 * une information — elles disparaissent quand on les refuse.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-normal active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-carte hover:bg-primary/90 active:bg-primary/95",
        destructive:
          "bg-destructive text-destructive-foreground shadow-carte hover:bg-destructive/90",
        outline:
          "border border-input bg-card shadow-carte hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        /* Sur le bleu pétrole du menu et des bandeaux profonds. */
        petrole:
          "bg-petrole text-petrole-foreground shadow-carte hover:bg-petrole-doux",
        /*
         * `text-primary` donnait de l'orange sur fond clair : 2,55, soit
         * presque illisible. L'encre orange foncée passe à 5,33.
         */
        link: "text-accent-encre underline-offset-4 hover:underline",
      },
      size: {
        /* 44 px au doigt, resserré dès qu'il y a une souris. */
        default: "h-11 px-4 py-2 sm:h-9",
        sm: "h-10 rounded-md px-3 text-xs sm:h-8",
        lg: "h-12 rounded-md px-6 text-base sm:h-10 sm:px-8",
        icon: "h-11 w-11 sm:h-9 sm:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
