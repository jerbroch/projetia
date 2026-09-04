import { describe, expect, it } from "vitest";
import { causeDuRefus, messageDeRefus, REFUS_SILENCIEUX } from "@/lib/cause-du-refus";

describe("causeDuRefus", () => {
  it("nomme le champ manquant plutôt que de dire « erreur »", () => {
    const m = causeDuRefus({
      code: "23502",
      message: 'null value in column "interac_email" violates not-null constraint',
    });
    expect(m).toContain("interac_email");
    expect(m).toContain("obligatoire");
  });

  it("traduit les refus courants de Postgres", () => {
    expect(causeDuRefus({ code: "23505", details: "Key (name) already exists." })).toContain("existe déjà");
    expect(causeDuRefus({ code: "22001" })).toContain("trop long");
    expect(causeDuRefus({ code: "42501" })).toContain("Droits insuffisants");
    expect(causeDuRefus({ code: "22P02" })).toContain("numériques");
  });

  // Une phrase inventée serait pire que le message technique : celui-ci se
  // recopie tel quel dans un signalement.
  it("rend le message brut quand le code est inconnu", () => {
    const m = causeDuRefus({ code: "XX999", message: "connection terminated unexpectedly" });
    expect(m).toBe("connection terminated unexpectedly");
  });

  it("ne fabrique rien quand il n'y a pas d'erreur", () => {
    expect(causeDuRefus(null)).toBeNull();
    expect(causeDuRefus(undefined)).toBeNull();
  });
});

describe("messageDeRefus", () => {
  it("dit d'abord ce qu'on tentait, puis l'obstacle", () => {
    const m = messageDeRefus("Coordonnées Interac", { code: "22001" });
    expect(m.startsWith("Coordonnées Interac :")).toBe(true);
    expect(m).toContain("trop long");
  });

  it("reste honnête quand la base ne dit rien", () => {
    expect(messageDeRefus("Taux de main-d'œuvre", null)).toContain("sans cause précisée");
  });
});

describe("REFUS_SILENCIEUX", () => {
  // Le pire des deux mondes : l'écran disait « enregistré » et rien n'avait
  // changé. Une RLS sans politique correspondante ne lève aucune erreur.
  it("explique le refus muet de la RLS et le geste à faire", () => {
    expect(REFUS_SILENCIEUX).toContain("Rien n'a été enregistré");
    expect(REFUS_SILENCIEUX).toContain("droits");
    expect(REFUS_SILENCIEUX).toContain("propriétaire");
  });
});
