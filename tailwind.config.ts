import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        /*
         * LES COULEURS PROPRES À CONSTRUCTION iOS.
         *
         * Le bleu pétrole du menu, l'orange lisible en encre, et les
         * cinq statuts. Ils vivent ici pour qu'un écran écrive
         * `text-succes` plutôt que de choisir un vert à lui.
         */
        petrole: {
          DEFAULT: "hsl(var(--petrole))",
          foreground: "hsl(var(--petrole-foreground))",
          doux: "hsl(var(--petrole-doux))",
          sombre: "hsl(var(--petrole-sombre))",
        },
        "accent-encre": "hsl(var(--accent-encre))",
        succes: "hsl(var(--succes))",
        attente: "hsl(var(--attente))",
        danger: "hsl(var(--danger))",
        neutre: "hsl(var(--neutre))",
        info: "hsl(var(--info))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        /* 16 px pour les cartes, 14 px par défaut, 12 px pour le menu. */
        xl: "calc(var(--radius) + 2px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 5px)",
      },
      boxShadow: {
        /* Discrètes : on suggère l'épaisseur, on ne la proclame pas. */
        carte: "var(--ombre-carte)",
        relief: "var(--ombre-relief)",
        flottant: "var(--ombre-flottant)",
      },
      transitionDuration: {
        /*
         * 150 à 220 ms. Au-delà, la transition se met à retarder
         * l'action au lieu de l'accompagner.
         */
        rapide: "150ms",
        normal: "180ms",
        ample: "220ms",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
