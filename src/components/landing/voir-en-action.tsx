"use client";

import { Button } from "@/components/ui/button";

/**
 * « Voir Construction iOS en action » — mène à la démonstration plus bas.
 *
 * Un `<a href="#demonstration">` ferait le même saut, en moins bien : le
 * défilement doux respecte `prefers-reduced-motion` par `scrollIntoView`, et
 * le focus est déplacé sur la section pour que la navigation au clavier
 * atterrisse là où l'œil atterrit. Sans ce déplacement, la tabulation
 * suivante repartirait du héros.
 */
export function VoirEnAction() {
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full border-[hsl(var(--plan-ligne)/0.5)] bg-transparent text-[hsl(var(--plan-trait))] hover:bg-[hsl(var(--plan-trait)/0.08)] hover:text-[hsl(var(--plan-trait))] sm:w-auto"
      onClick={() => {
        const cible = document.getElementById("demonstration");
        if (!cible) return;
        const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        cible.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "start" });
        cible.focus({ preventScroll: true });
      }}
    >
      Voir Construction iOS en action
    </Button>
  );
}
