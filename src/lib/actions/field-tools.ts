"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createToolAssignment,
  getToolAssignmentsForTool,
  getToolsWithDetails,
  mapToolAssignmentRow,
} from "@/lib/data/tools-data";
import { getEmployees } from "@/lib/data/tenant-data";
import {
  MESSAGE_PRISE_SIMULTANEE,
  estUnePriseSimultanee,
  noteApresRetour,
  peutPrendreLOutil,
  reservationQuiBloque,
  retourProposeParDefaut,
  retourSignaleUnProbleme,
  saReservation,
} from "@/lib/outils-terrain";
import { requireFieldContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { todayDateString } from "@/lib/tool-utils";
import type { ToolListItem } from "@/types";

/**
 * LE TRAVAILLEUR PREND ET REND SES OUTILS LUI-MÊME.
 *
 * Avant, seul le bureau écrivait dans `tool_assignments`. Un homme qui
 * empruntait une scie devait appeler quelqu'un pour qu'il le saisisse : dans
 * les faits, personne n'appelait, et l'inventaire ne correspondait jamais au
 * contenu des camions.
 *
 * DEUX PRINCIPES GOUVERNENT CE FICHIER.
 *
 * 1. L'IDENTITÉ VIENT DE LA SESSION, JAMAIS DU FORMULAIRE. `employeeId` n'est
 *    pas lu dans `formData` — sinon il suffirait de changer un champ caché
 *    pour sortir un outil au nom d'un collègue.
 *
 * 2. ON ÉCRIT AVEC LE CLIENT DE L'UTILISATEUR, pas avec la clé de service.
 *    Les politiques RLS de la migration 048 s'appliquent donc réellement à
 *    chaque écriture. Passer par l'admin rendrait ces politiques décoratives :
 *    elles seraient vraies en base et contournées par le code.
 */

export type ResultatOutilTerrain =
  | { success: true; outils: ToolListItem[] }
  | { success: false; error: string };

const priseSchema = z.object({
  toolId: z.string().uuid("Outil invalide"),
  expectedReturnDate: z.string().trim().min(1, "La date de retour est requise"),
  scheduledJobId: z.string().uuid().optional(),
  notes: z.string().trim().max(500, "Note trop longue").optional(),
});

const retourSchema = z.object({
  /*
   * ON REÇOIT L'OUTIL, PAS LA PRISE.
   *
   * L'écran du travailleur montre des outils ; l'identifiant de la ligne
   * d'attribution ne l'intéresse pas et n'a pas à circuler dans un formulaire.
   * Le serveur retrouve lui-même LA prise ouverte à SON nom : c'est une
   * garantie de plus, puisqu'aucun identifiant envoyé par le client ne peut
   * désigner la prise de quelqu'un d'autre.
   */
  toolId: z.string().uuid("Outil invalide"),
  etat: z.enum(["good", "damaged", "needs_repair", "missing_part", "other"]),
  notes: z.string().trim().max(500, "Note trop longue").optional(),
});

function echec(message: string): ResultatOutilTerrain {
  return { success: false, error: message };
}

/**
 * Les deux vues bougent ensemble.
 *
 * Une prise faite au dépôt doit apparaître au bureau sans que personne ne
 * recharge quoi que ce soit : c'est la moitié de l'intérêt de laisser le
 * terrain saisir ses mouvements.
 */
function revalider() {
  revalidatePath("/terrain/outils");
  revalidatePath("/terrain");
  revalidatePath("/outillage");
  revalidatePath("/employees");
}

async function outilsDuTerrain(companyId: string, isDemo: boolean): Promise<ToolListItem[]> {
  const employees = await getEmployees(companyId, isDemo);
  return getToolsWithDetails(companyId, isDemo, employees);
}

/** L'employé emporte un outil du dépôt. */
export async function prendreOutilAction(formData: FormData): Promise<ResultatOutilTerrain> {
  const ctx = await requireFieldContext();
  if (ctx.isDemo) return echec("La démonstration ne modifie pas l'inventaire.");
  if (!isSupabaseConfigured()) return echec("Supabase n'est pas configuré.");

  const parsed = priseSchema.safeParse({
    toolId: formData.get("toolId"),
    expectedReturnDate: formData.get("expectedReturnDate") || retourProposeParDefaut(),
    scheduledJobId: formData.get("scheduledJobId") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return echec(parsed.error.errors[0]?.message ?? "Données invalides");

  const employeId = ctx.employeeId!;
  const debut = todayDateString();
  if (parsed.data.expectedReturnDate < debut) {
    return echec("La date de retour ne peut pas être avant aujourd'hui.");
  }

  const outils = await outilsDuTerrain(ctx.company.id, ctx.isDemo);
  const outil = outils.find((o) => o.id === parsed.data.toolId);
  if (!outil) return echec("Outil introuvable dans votre entreprise.");

  const verdict = peutPrendreLOutil(outil, employeId);
  if (!verdict.possible) return echec(verdict.motif);

  // Les réservations : celle d'un collègue interdit, la sienne autorise.
  const { data: lignes } = await getToolAssignmentsForTool(ctx.company.id, parsed.data.toolId);
  const assignations = (lignes ?? []).map(mapToolAssignmentRow);
  const bloquante = reservationQuiBloque(
    assignations,
    employeId,
    debut,
    parsed.data.expectedReturnDate,
  );
  if (bloquante) {
    return echec(
      `Cet outil est réservé du ${bloquante.startDate} au ${bloquante.expectedReturnDate}.`,
    );
  }

  const supabase = await createClient();

  /*
   * SA PROPRE RÉSERVATION DEVIENT LA PRISE.
   *
   * En créer une seconde à côté laisserait deux lignes ouvertes pour le même
   * outil : l'index unique de la base refuserait, et le réservataire ne
   * pourrait pas prendre l'outil qu'il avait lui-même réservé.
   */
  const sienne = saReservation(assignations, employeId, debut, parsed.data.expectedReturnDate);
  if (sienne) {
    const { error } = await supabase
      .from("tool_assignments")
      .update({
        status: "active",
        start_date: debut,
        expected_return_date: parsed.data.expectedReturnDate,
        scheduled_job_id: parsed.data.scheduledJobId ?? null,
        notes: parsed.data.notes ?? sienne.notes ?? null,
      })
      .eq("id", sienne.id)
      .eq("company_id", ctx.company.id);

    if (error) {
      if (estUnePriseSimultanee(error.code)) return echec(MESSAGE_PRISE_SIMULTANEE);
      console.error("[prendreOutilAction:reservation]", error.message);
      return echec("Impossible d'enregistrer la prise.");
    }
    revalider();
    return { success: true, outils: await outilsDuTerrain(ctx.company.id, ctx.isDemo) };
  }

  const { error } = await createToolAssignment(ctx.company.id, parsed.data.toolId, {
    employeeId: employeId,
    startDate: debut,
    expectedReturnDate: parsed.data.expectedReturnDate,
    notes: parsed.data.notes,
    createdByUserId: ctx.user.id,
    scheduledJobId: parsed.data.scheduledJobId ?? null,
  });

  if (error) {
    // L'index unique a tranché une course : quelqu'un a été plus rapide.
    if (estUnePriseSimultanee(error.code)) return echec(MESSAGE_PRISE_SIMULTANEE);
    console.error("[prendreOutilAction]", error.message);
    return echec("Impossible d'enregistrer la prise.");
  }

  revalider();
  return { success: true, outils: await outilsDuTerrain(ctx.company.id, ctx.isDemo) };
}

/** L'employé rapporte un outil qu'il détient. */
export async function retournerOutilAction(formData: FormData): Promise<ResultatOutilTerrain> {
  const ctx = await requireFieldContext();
  if (ctx.isDemo) return echec("La démonstration ne modifie pas l'inventaire.");
  if (!isSupabaseConfigured()) return echec("Supabase n'est pas configuré.");

  const parsed = retourSchema.safeParse({
    toolId: formData.get("toolId"),
    etat: formData.get("etat") || "good",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return echec(parsed.error.errors[0]?.message ?? "Données invalides");

  if (retourSignaleUnProbleme(parsed.data.etat) && !parsed.data.notes) {
    return echec("Décrivez le problème en quelques mots.");
  }

  const supabase = await createClient();

  /*
   * ON RELIT LA PRISE AVANT DE LA FERMER, pour deux raisons : conserver la
   * note d'origine, et refuser proprement un second envoi. Un double
   * appui — fréquent avec des gants — ne doit pas produire deux mouvements.
   */
  const { data: ligne } = await supabase
    .from("tool_assignments")
    .select("*")
    .eq("company_id", ctx.company.id)
    .eq("tool_id", parsed.data.toolId)
    .eq("employee_id", ctx.employeeId!)
    .eq("status", "active")
    .is("actual_return_date", null)
    .maybeSingle();

  if (!ligne) {
    // Soit l'outil n'est pas à son nom, soit le retour est déjà passé — un
    // double appui avec des gants, par exemple.
    return echec("Aucune sortie à votre nom pour cet outil. Elle est peut-être déjà rendue.");
  }
  const prise = mapToolAssignmentRow(ligne as Record<string, unknown>);

  const { error } = await supabase
    .from("tool_assignments")
    .update({
      actual_return_date: todayDateString(),
      return_condition: parsed.data.etat,
      status: "returned",
      notes: noteApresRetour(prise.notes, parsed.data.notes),
    })
    .eq("id", prise.id)
    .eq("company_id", ctx.company.id)
    .eq("status", "active");

  if (error) {
    console.error("[retournerOutilAction]", error.message);
    return echec("Impossible d'enregistrer le retour.");
  }

  /*
   * UN OUTIL ABÎMÉ NE RETOURNE PAS AU PARC DISPONIBLE.
   *
   * Le passage en réparation est fait par une fonction de base qui revérifie
   * que l'appelant détenait bien l'outil : `tools` reste fermée au terrain.
   * Si ce second temps échoue, le retour reste enregistré — mais on le DIT,
   * plutôt que d'afficher un succès pendant qu'un outil cassé repart au
   * chantier suivant.
   */
  if (retourSignaleUnProbleme(parsed.data.etat)) {
    const { error: signalError } = await supabase.rpc("signaler_outil_a_reparer", {
      p_assignment_id: prise.id,
    });
    if (signalError) {
      console.error("[retournerOutilAction:signalement]", signalError.message);
      revalider();
      return echec(
        "Retour enregistré, mais l'outil n'a pas pu être marqué à réparer. Prévenez le bureau.",
      );
    }
  }

  revalider();
  return { success: true, outils: await outilsDuTerrain(ctx.company.id, ctx.isDemo) };
}

/** La liste fraîche, pour le retour sur l'application et après reconnexion. */
export async function rafraichirOutilsTerrainAction(): Promise<ResultatOutilTerrain> {
  const ctx = await requireFieldContext();
  if (!isSupabaseConfigured()) return echec("Supabase n'est pas configuré.");
  return { success: true, outils: await outilsDuTerrain(ctx.company.id, ctx.isDemo) };
}
