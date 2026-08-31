"use server";

import {
  lignesDeMainOeuvre,
  lignesDeMateriaux,
  lignesQueLImportEcraserait,
  resumeDesHeures,
  saisiesNonImportees,
  type LigneExistante,
} from "@/lib/billing-field-import";
import { getPrixCatalogue, getSaisiesTerrain } from "@/lib/data/billing-field-data";
import { getJobBillingSheet, getLaborRateTemplates } from "@/lib/data/billing-data";
import { getScheduledJobById } from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export interface ApercuImport {
  /** Ce qui serait ajouté ou remplacé. */
  lignesTravail: number;
  lignesMateriaux: number;
  /** Lignes retouchées à la main que l'import détruirait. */
  aEcraser: string[];
  /** Saisies arrivées après le dernier import. */
  heuresEnRetard: number;
  materiauxEnRetard: number;
  /** Matériaux sans prix connu. */
  sansPrix: string[];
  resume: { prevu: number; reel: number; ecart: number; nonImportees: number };
}

async function contexte(jobId: string) {
  const ctx = await requireTenantContext();
  const job = await getScheduledJobById(ctx.company.id, jobId, false);
  const sheet = await getJobBillingSheet(ctx.company.id, jobId);
  const { heures, materiaux } = await getSaisiesTerrain(ctx.company.id, jobId);
  const prix = await getPrixCatalogue(
    ctx.company.id,
    [...new Set(materiaux.map((m) => m.catalogItemId).filter(Boolean) as string[])],
  );
  const gabarits = await getLaborRateTemplates(ctx.company.id);
  return { ctx, job, sheet, heures, materiaux, prix, gabarits };
}

function lignesExistantes(sheet: { lines?: unknown[] } | null): LigneExistante[] {
  return ((sheet?.lines ?? []) as Record<string, unknown>[]).map((l) => ({
    id: String(l.id),
    sourceKind: l.sourceKind ? String(l.sourceKind) : null,
    sourceIds: Array.isArray(l.sourceIds) ? (l.sourceIds as string[]) : [],
    manuallyEdited: Boolean(l.manuallyEdited),
    description: String(l.description ?? ""),
  }));
}

/**
 * Ce que l'import ferait, SANS rien écrire.
 *
 * Sert au bandeau de la feuille et à la confirmation avant écrasement : on ne
 * détruit pas une correction sans nommer ce qu'on détruit.
 */
export async function apercuImportTerrainAction(
  jobId: string,
  templateId?: string,
): Promise<{ success: true; data: ApercuImport } | { success: false; error: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };
  const { job, sheet, heures, materiaux, prix, gabarits } = await contexte(jobId);

  const gabarit = gabarits.find((g) => g.id === templateId) ?? gabarits[0] ?? null;
  const travail = lignesDeMainOeuvre(heures, gabarit ? { id: gabarit.id, name: gabarit.name, billRate: gabarit.billRate } : null);
  const mats = lignesDeMateriaux(materiaux, prix);
  const existantes = lignesExistantes(sheet);
  const retard = saisiesNonImportees(existantes, heures, materiaux);

  return {
    success: true,
    data: {
      lignesTravail: travail.length,
      lignesMateriaux: mats.length,
      aEcraser: lignesQueLImportEcraserait(existantes).map((l) => l.description),
      heuresEnRetard: retard.heures.length,
      materiauxEnRetard: retard.materiaux.length,
      sansPrix: [...travail, ...mats].filter((l) => l.prixAsaisir).map((l) => l.description),
      resume: resumeDesHeures(
        job?.quoteEstimationSnapshot?.estimatedHours ?? 0,
        heures,
        existantes,
      ),
    },
  };
}

/**
 * Déverse les saisies terrain dans la feuille.
 *
 * Les lignes déjà importées sont remplacées, sauf celles retouchées à la main :
 * celles-là ne partent que si l'employeur l'a explicitement demandé. Les lignes
 * ajoutées à la main, sans origine terrain, ne sont jamais touchées.
 */
export async function importerTerrainAction(input: {
  jobId: string;
  templateId?: string;
  ecraserModifiees?: boolean;
}): Promise<{ success: true; importees: number } | { success: false; error: string }> {
  const { ctx, sheet, heures, materiaux, prix, gabarits } = await contexte(input.jobId);
  if (!sheet) return { success: false, error: "Feuille de facturation introuvable." };

  const gabarit = gabarits.find((g) => g.id === input.templateId) ?? gabarits[0] ?? null;
  const propositions = [
    ...lignesDeMainOeuvre(heures, gabarit ? { id: gabarit.id, name: gabarit.name, billRate: gabarit.billRate } : null),
    ...lignesDeMateriaux(materiaux, prix),
  ];

  const admin = createAdminClient();
  const existantes = lignesExistantes(sheet);
  const aRetirer = existantes
    .filter((l) => l.sourceKind && (input.ecraserModifiees || !l.manuallyEdited))
    .map((l) => l.id);

  if (aRetirer.length) {
    await admin.from("job_billing_lines").delete().in("id", aRetirer);
  }

  // On garde les lignes retouchées : leurs saisies ne doivent pas être
  // réimportées en double.
  const conservees = existantes.filter((l) => l.sourceKind && !aRetirer.includes(l.id));
  const dejaCouvertes = new Set(conservees.flatMap((l) => l.sourceIds ?? []));
  // On écarte toute proposition qui recoupe une ligne conservée, même
  // partiellement. Avec `every` au lieu de `some`, une heure saisie en retard
  // faisait insérer une ligne couvrant TOUTES les heures de l'employé à côté
  // de la ligne corrigée : le gars était facturé deux fois. Mieux vaut ne rien
  // importer et le dire — le bandeau signale déjà les heures non facturées.
  const aInserer = propositions.filter((p) => !p.sourceIds.some((id) => dejaCouvertes.has(id)));

  if (aInserer.length) {
    const depart = existantes.length;
    const { error } = await admin.from("job_billing_lines").insert(
      aInserer.map((p, i) => ({
        billing_sheet_id: sheet.id,
        company_id: ctx.company.id,
        line_type: p.lineType,
        description: p.description,
        quantity: p.quantity,
        // Un matériau se chiffre depuis unit_cost : la marge de l'entreprise
        // est appliquée globalement au sous-total (voir calculateBillingTotals).
        // Poser le prix dans unit_sell_price seul le laisserait à zéro dans le
        // total — c'est ce que faisait la première version.
        unit_cost: p.unitSellPrice,
        unit_sell_price: p.unitSellPrice,
        line_total: Math.round(p.quantity * p.unitSellPrice * 100) / 100,
        source_kind: p.sourceKind,
        source_ids: p.sourceIds,
        manually_edited: false,
        sort_order: depart + i,
      })),
    );
    if (error) {
      console.error("[importerTerrainAction]", error.message);
      return { success: false, error: "Impossible d'importer les saisies du terrain." };
    }
  }

  const { recalculateBillingSheetTotals } = await import("@/lib/data/billing-data");
  await recalculateBillingSheetTotals(ctx.company.id, sheet.id, ctx.company);

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/invoices");
  revalidatePath("/schedule");
  return { success: true, importees: aInserer.length };
}
