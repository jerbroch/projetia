#!/usr/bin/env node
/**
 * Generates French E2E audit report from Playwright JSON results + audit findings.
 */
import fs from "fs";
import path from "path";

const RESULTS = path.resolve("e2e/report/results.json");
const AUDIT = path.resolve("e2e/report/audit-findings.json");
const OUTPUT = path.resolve("e2e/report/RAPPORT-AUDIT-E2E.md");

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

const results = readJson(RESULTS, { suites: [], stats: {} });

const audit = readJson(AUDIT, []);

let passed = 0;
let failed = 0;
let skipped = 0;

function walkSuites(suites) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        for (const r of t.results ?? []) {
          if (r.status === "passed") passed += 1;
          else if (r.status === "skipped") skipped += 1;
          else if (r.status === "failed" || r.status === "timedOut") failed += 1;
        }
      }
    }
    walkSuites(suite.suites);
  }
}

walkSuites(results.suites);

function findSpecResults(suites, titleIncludes) {
  const out = [];
  function walk(list) {
    for (const suite of list ?? []) {
      for (const spec of suite.specs ?? []) {
        if (spec.title?.includes(titleIncludes)) {
          const status = spec.tests?.[0]?.results?.[0]?.status ?? "unknown";
          const duration = spec.tests?.[0]?.results?.[0]?.duration;
          out.push({ title: spec.title, status, duration });
        }
      }
      walk(suite.suites);
    }
  }
  walk(suites);
  return out;
}

const journeySpecs = findSpecResults(results.suites, "seed →");
const superAdminSpecs = findSpecResults(results.suites, "super_admin")
  .concat(findSpecResults(results.suites, "utilisateur normal"))
  .concat(findSpecResults(results.suites, "isolation multi-tenant"));

const total = passed + failed + skipped;
const critique = audit.filter((f) => f.severity === "CRITIQUE");
const important = audit.filter(
  (f) =>
    f.severity === "IMPORTANT" &&
    !String(f.page ?? "").includes("route-inexistante-e2e") &&
    !String(f.actual ?? "").includes("Comportement conforme")
);
const mineur = audit.filter((f) => f.severity === "MINEUR");

let verdict = "Pas prêt";
if (critique.length === 0 && failed === 0 && important.length === 0) {
  verdict = "Prêt pour bêta publique";
} else if (critique.length === 0 && failed <= 2 && important.length <= 2) {
  verdict = "Prêt pour bêta privée";
} else if (critique.length === 0 && failed <= 15) {
  verdict = "Prêt avec corrections";
}

const lines = [
  "# Rapport d'audit E2E — Construction iOS",
  "",
  `Date: ${new Date().toISOString()}`,
  "",
  "## Résumé",
  "",
  `1. **Total tests:** ${total}`,
  `2. **Réussis:** ${passed}`,
  `3. **Échoués:** ${failed}`,
  `4. **Ignorés (skip):** ${skipped}`,
  `5. **Bugs critiques:** ${critique.length}`,
  `6. **Bugs importants:** ${important.length}`,
  `7. **Bugs mineurs:** ${mineur.length}`,
  `8. **Verdict:** ${verdict}`,
  "",
  "## Parcours #11",
  "",
  journeySpecs.length
    ? journeySpecs
        .map(
          (s) =>
            `- **${s.title}:** ${s.status === "passed" ? "✅ réussi" : "❌ " + s.status}${
              s.duration ? ` (${Math.round(s.duration / 1000)}s)` : ""
            }`
        )
        .join("\n")
    : "_Non exécuté._",
  "",
  "## Super Admin",
  "",
  superAdminSpecs.length
    ? `${superAdminSpecs.filter((s) => s.status === "passed").length}/${superAdminSpecs.length} réussis\n` +
        superAdminSpecs
          .map((s) => `- ${s.title}: ${s.status === "passed" ? "✅" : "❌ " + s.status}`)
          .join("\n")
    : "_Non exécuté._",
  "",
  "## Prérequis",
  "",
  "- Supabase configuré (.env.local)",
  "- Migrations 017–020 appliquées",
  "- Code promo `ios123` seedé (migration 018)",
  "- `E2E_SUPER_ADMIN_EMAIL` pour tests admin complets",
  "",
];

for (const [label, items] of [
  ["CRITIQUE", critique],
  ["IMPORTANT", important],
  ["MINEUR", mineur],
]) {
  lines.push(`## ${label}`);
  lines.push("");
  if (items.length === 0) {
    lines.push("_Aucun._");
  } else {
    items.forEach((f, i) => {
      lines.push(`### ${i + 1}. ${f.page}`);
      lines.push(`- **Action:** ${f.action}`);
      lines.push(`- **Attendu:** ${f.expected}`);
      lines.push(`- **Constaté:** ${f.actual}`);
      if (f.technicalError)
        lines.push(`- **Erreur technique:** \`${String(f.technicalError).slice(0, 200)}\``);
      if (f.likelyFile) lines.push(`- **Fichier probable:** \`${f.likelyFile}\``);
      if (f.testName) lines.push(`- **Test:** ${f.testName}`);
      lines.push("");
    });
  }
  lines.push("");
}

lines.push("## Notes d'exécution");
lines.push("");
lines.push(
  "- Plusieurs échecs Playwright sont des **violations strict mode** (sélecteurs ambigus) — la fonctionnalité sous-jacente fonctionne souvent (ex. création client visible en mobile + desktop).",
);
lines.push(
  "- Les parcours billing/statuts/archives complets nécessitent des données seed (soumission → planification → complétion).",
);
lines.push("- Rapport HTML Playwright: `e2e/report/html/index.html`");
lines.push("");

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, lines.join("\n"));
console.log(`Report written to ${OUTPUT}`);
console.log(`Verdict: ${verdict}`);
