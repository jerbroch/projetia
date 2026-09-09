import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/session";
import { avecMesure, resume } from "@/lib/mesure-requetes";
import { enTeteServerTiming } from "@/lib/server-timing";

/**
 * OÙ PART LE TEMPS, MESURÉ DEPUIS LE SERVEUR QUI SERT LE SITE.
 *
 * Chronométrer depuis un poste de développement ne dit rien du produit : un
 * aller-retour vers Supabase coûte 83 ms depuis un salon et une poignée de
 * millisecondes depuis un serveur Vercel voisin de la base. Les deux mesures
 * sont vraies ; une seule décrit ce que vivent les clients.
 *
 * Ce point de contrôle fait le travail LÀ où il se fait réellement et rend les
 * durées. Il ne lit que des compteurs et une ligne d'entreprise — aucune
 * écriture, aucune donnée de client.
 *
 * Réservé au super administrateur : la latence d'une infrastructure n'a pas à
 * être publique.
 */
export const dynamic = "force-dynamic";

async function chronometre<T>(travail: () => Promise<T>): Promise<[T, number]> {
  const debut = performance.now();
  const r = await travail();
  return [r, performance.now() - debut];
}

/** Médiane plutôt que moyenne : un pic réseau ne doit pas décider du verdict. */
function mediane(xs: number[]): number {
  const t = [...xs].sort((a, b) => a - b);
  return Math.round(t[Math.floor(t.length / 2)] ?? 0);
}

export async function GET() {
  await requireSuperAdminUser();

  return avecMesure(async () => {
    const supabase = await createClient();

    // 1. L'aller-retour nu, répété : c'est le prix unitaire de tout le reste.
    const allersRetours: number[] = [];
    for (let i = 0; i < 5; i++) {
      const [, ms] = await chronometre(async () => {
        await supabase.from("companies").select("id").limit(1);
      });
      allersRetours.push(ms);
    }

    // 2. Résoudre « qui es-tu » : le premier appel de chaque page.
    const [, msContexte] = await chronometre(() => getTenantContext());

    // 3. Le même, une seconde fois. Avec la mémoïsation par requête, il ne
    //    doit RIEN coûter — c'est la preuve directe qu'elle agit.
    const [, msContexteRepete] = await chronometre(() => getTenantContext());

    // 4. Cinq lectures lancées de front : montre ce que la mise en parallèle
    //    fait gagner par rapport à la somme des attentes.
    const [, msParallele] = await chronometre(async () => {
      await Promise.all([
        supabase.from("customers").select("id").limit(20),
        supabase.from("quotes").select("id").limit(20),
        supabase.from("invoices").select("id").limit(20),
        supabase.from("scheduled_jobs").select("id").limit(20),
        supabase.from("employees").select("id").limit(20),
      ]);
    });

    // 5. Les mêmes, à la file. L'écart est le coût de la sérialisation.
    const [, msSerie] = await chronometre(async () => {
      await supabase.from("customers").select("id").limit(20);
      await supabase.from("quotes").select("id").limit(20);
      await supabase.from("invoices").select("id").limit(20);
      await supabase.from("scheduled_jobs").select("id").limit(20);
      await supabase.from("employees").select("id").limit(20);
    });

    const r = resume();
    const unAllerRetour = mediane(allersRetours);

    const corps = {
      region: process.env.VERCEL_REGION ?? "local",
      unAllerRetourMs: unAllerRetour,
      contexteMs: Math.round(msContexte),
      contexteRepeteMs: Math.round(msContexteRepete),
      memoisationAgit: msContexteRepete < Math.max(5, msContexte / 4),
      cinqLecturesParallelesMs: Math.round(msParallele),
      cinqLecturesEnSerieMs: Math.round(msSerie),
      gainDuParallelismeMs: Math.round(msSerie - msParallele),
      appels: r?.total ?? 0,
      sommeDesAttentesMs: r?.msTotal ?? 0,
      parCible: r?.parCible ?? [],
      // Ce qu'un plancher d'une page coûterait, en admettant dix appels
      // séquentiels — l'ordre de grandeur observé sur une page authentifiée.
      plancherEstimeMs: unAllerRetour * 10,
    };

    return NextResponse.json(corps, {
      headers: {
        "Server-Timing": enTeteServerTiming({
          allerRetour: unAllerRetour,
          contexte: msContexte,
          contexteRepete: msContexteRepete,
          paralleles: msParallele,
          serie: msSerie,
        }),
        "Cache-Control": "no-store",
      },
    });
  });
}
