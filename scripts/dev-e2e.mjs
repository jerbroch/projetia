#!/usr/bin/env node
/**
 * Démarre le serveur de développement sur la base de DÉVELOPPEMENT.
 *
 * `npm run dev` charge `.env.local`, qui pointe sur la PRODUCTION. Seul
 * playwright.config.ts chargeait `.env.e2e` en premier — et comme dotenv
 * n'écrase jamais une variable déjà posée, c'est lui qui gagnait. Relancer le
 * serveur à la main suffisait donc à basculer sur les vraies données.
 *
 * L'ORDRE EST TOUT : `.env.e2e` d'abord, `.env.local` ensuite pour compléter
 * ce qui manque (Stripe, Resend…) sans jamais écraser la base visée.
 */
import { config } from "dotenv";
import { spawn } from "node:child_process";

config({ path: ".env.e2e" });
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(aucune)";
const ref = /https?:\/\/([a-z0-9]+)\.supabase\./i.exec(url)?.[1] ?? "?";
const sure = process.env.DEV_SAFE_SUPABASE_REF?.trim();

console.log(`\n  Base visée : ${ref}${sure === ref ? "  ✓ base de développement" : "  ⚠ CE N'EST PAS LA BASE DE TEST DÉCLARÉE"}\n`);

spawn("npx", ["next", "dev"], {
  env: { ...process.env, PORT: process.env.PORT ?? "3000" },
  stdio: "inherit",
});
