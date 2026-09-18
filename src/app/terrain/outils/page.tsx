import { FieldLayout } from "@/components/field/field-layout";
import { FieldToolsPageClient } from "@/components/field/field-tools-page-client";
import {
  getFieldJobsForEmployeeScoped,
  getNomsDesEmployesPourTerrain,
} from "@/lib/data/field-data";
import { getEmployeeToolSummary, getToolsWithDetails } from "@/lib/data/tools-data";
import { filterJobsByFieldView } from "@/lib/field-schedule-utils";
import { toFieldSafeScheduleEvent } from "@/lib/field-permissions";
import { requireFieldContext } from "@/lib/session";

/**
 * MES OUTILS — le même inventaire que le bureau, vu depuis le camion.
 *
 * Rien n'est recopié ni dupliqué : `getToolsWithDetails` est exactement la
 * fonction qui sert l'écran Outillage de l'employeur. Un second inventaire
 * « côté terrain » aurait divergé dès la première semaine.
 */
export default async function TerrainToolsPage() {
  const ctx = await requireFieldContext();

  // Les NOMS seulement : la fiche employé reste fermée au terrain.
  const employees = await getNomsDesEmployesPourTerrain(ctx.company.id, ctx.isDemo);
  const [outils, resume, jobs] = await Promise.all([
    getToolsWithDetails(ctx.company.id, ctx.isDemo, employees),
    getEmployeeToolSummary(ctx.company.id, ctx.employeeId!, ctx.isDemo, employees),
    getFieldJobsForEmployeeScoped(ctx.company.id, ctx.employeeId!, ctx.isDemo),
  ]);

  // Les chantiers proposés au moment de la prise : ceux de sa semaine, pas
  // tout l'historique de l'entreprise.
  const chantiers = filterJobsByFieldView(jobs.map(toFieldSafeScheduleEvent), "week").map((j) => ({
    id: j.id,
    titre: j.title,
    client: j.customerName ?? null,
  }));

  return (
    <FieldLayout company={ctx.company} user={ctx.user}>
      <FieldToolsPageClient
        outilsInitiaux={outils}
        employeId={ctx.employeeId!}
        historique={resume.history}
        chantiers={chantiers}
      />
    </FieldLayout>
  );
}
