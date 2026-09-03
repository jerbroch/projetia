import type { ScheduleEvent } from "@/types";

export type JobNumberType = "contract" | "service_call";
export type JobOrigin = "quote" | "direct";

export const JOB_NUMBER_PREFIX: Record<JobNumberType, string> = {
  contract: "CON",
  service_call: "BT",
};

export const JOB_ORIGIN_LABELS: Record<JobOrigin, string> = {
  quote: "Soumission",
  direct: "Direct",
};

export const JOB_NUMBER_TYPE_LABELS: Record<JobNumberType, string> = {
  contract: "Contrat",
  service_call: "Bon de travail",
};

/**
 * Ce qui est FINI, et rien d'autre.
 *
 * La règle regardait `completed` et `pending-review` : un travail fait mais
 * PAS ENCORE FACTURÉ était rangé aux archives, pendant qu'un call payé restait
 * indéfiniment dans le courant. Les archives de Jérôme contenaient zéro call
 * alors que deux étaient encaissés.
 *
 * C'était cohérent quand « terminé » voulait dire « classé ». Depuis que
 * `completed` signifie « à vérifier », un travail dans cet état attend une
 * action de l'entrepreneur — ce n'est pas une archive, c'est une tâche. Il vit
 * maintenant dans « À vérifier », et nulle part ailleurs.
 *
 * Encaissé ou abandonné : voilà ce qui se range.
 */
export const ARCHIVE_STATUSES: ScheduleEvent["status"][] = ["paid", "cancelled"];

export function isArchivedJob(event: Pick<ScheduleEvent, "status">): boolean {
  return ARCHIVE_STATUSES.includes(event.status);
}

export function resolveJobNumberType(event: Pick<ScheduleEvent, "jobNumberType" | "quoteId">): JobNumberType {
  if (event.jobNumberType) return event.jobNumberType;
  return event.quoteId ? "contract" : "service_call";
}

export function resolveJobOrigin(event: Pick<ScheduleEvent, "jobOrigin" | "quoteId">): JobOrigin {
  if (event.jobOrigin) return event.jobOrigin;
  return event.quoteId ? "quote" : "direct";
}

export function formatJobNumber(type: JobNumberType, year: number, sequence: number): string {
  const prefix = JOB_NUMBER_PREFIX[type];
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function parseJobNumber(jobNumber: string): { prefix: string; year: number; sequence: number } | null {
  const match = jobNumber.match(/^(CON|BT)-(\d{4})-(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    year: parseInt(match[2], 10),
    sequence: parseInt(match[3], 10),
  };
}

export function buildDemoJobNumber(
  existing: Pick<ScheduleEvent, "jobNumber">[],
  type: JobNumberType,
  year = new Date().getFullYear()
): string {
  const prefix = JOB_NUMBER_PREFIX[type];
  const pattern = new RegExp(`^${prefix}-${year}-`);
  const maxSeq = existing
    .map((event) => event.jobNumber)
    .filter((value): value is string => Boolean(value && pattern.test(value)))
    .reduce((max, value) => {
      const parsed = parseJobNumber(value);
      return parsed ? Math.max(max, parsed.sequence) : max;
    }, 0);

  return formatJobNumber(type, year, maxSeq + 1);
}

export function getJobDisplayNumber(event: Pick<ScheduleEvent, "jobNumber">): string {
  return event.jobNumber ?? "—";
}

export function getJobYear(event: Pick<ScheduleEvent, "start" | "jobNumber">): number {
  if (event.jobNumber) {
    const parsed = parseJobNumber(event.jobNumber);
    if (parsed) return parsed.year;
  }
  return new Date(event.start).getFullYear();
}
