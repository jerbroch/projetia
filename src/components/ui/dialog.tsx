"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      /* Le voile prend le bleu de la charte plutôt qu'un noir pur, et
         reste assez transparent pour qu'on garde ses repères derrière. */
      "fixed inset-0 z-50 bg-petrole/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        /*
         * TROIS CORRECTIONS DE FOND.
         *
         * `max-h` + `overflow-y-auto` : un formulaire long dépassait
         * simplement de l'écran. Sur téléphone, le clavier réduit encore la
         * hauteur utile et le bouton « Enregistrer » se retrouvait hors
         * d'atteinte, sans aucun moyen d'y accéder. `dvh` suit la hauteur
         * réellement visible, ce que `vh` ne fait pas quand le clavier monte.
         *
         * `bg-card` : le fond était `bg-background`, devenu ivoire — le
         * dialogue se confondait avec la page derrière lui.
         *
         * L'arrondi ne se limite plus à `sm` : sur téléphone, le dialogue
         * avait des coins carrés au milieu d'une interface arrondie.
         *
         * NE PAS RETIRER LES `slide-in-from-left-1/2`. Elles ont l'air
         * décoratives ; elles portent en fait la translation de -50 % pendant
         * toute l'animation. Sans elles, l'animation d'ouverture impose son
         * propre `transform` et écrase `translate-x-[-50%]` : le dialogue
         * s'ouvre décalé et sort de l'écran par la droite. Mesuré.
         */
        "fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain rounded-xl border border-border/70 bg-card p-4 shadow-flottant duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[state=open]:zoom-in-100 sm:w-full sm:p-6",
        className
      )}
      {...props}
    >
      {children}
      {/*
        La croix visait 16 px. Elle offre maintenant 44 px PLEINS au doigt —
        `h-11` seul rendait 43,2 px une fois le rem arrondi par le
        navigateur, soit juste sous la cible. `min-h`/`min-w` en pixels ne
        laissent pas la place au doute. C'est le bouton qu'on cherche quand
        on s'est trompé de fenêtre.
      */}
      <DialogPrimitive.Close className="absolute right-2 top-2 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors duration-rapide hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none motion-reduce:transition-none sm:right-3 sm:top-3">
        <X className="h-4 w-4" />
        {/*
          « Fermer LA FENÊTRE », pas « Fermer ». Plusieurs formulaires portent
          déjà un bouton « Fermer » parmi leurs actions : en traduisant le
          « Close » d'origine par le même mot, j'ai créé deux boutons de même
          nom dans le même dialogue. Le parcours complet est tombé dessus —
          « resolved to 2 elements ». Le nom doit désigner une seule chose.
        */}
        <span className="sr-only">Fermer la fenêtre</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  /* `pr-10` laisse la place à la croix : sans elle, un titre long passait
     dessous et devenait illisible sur les deux derniers mots. */
  <div
    className={cn("flex flex-col space-y-1.5 pr-10 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  /* `gap` plutôt que `space-x` : en colonne inversée sur téléphone,
     `space-x` ne sépare rien et les boutons se touchaient. */
  <div
    className={cn(
      "flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-2 sm:pt-0",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
