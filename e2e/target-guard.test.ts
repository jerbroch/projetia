import { afterEach, describe, expect, it, vi } from "vitest";
import { cibleDuServeurConfirmee } from "./target-guard";

const DEV = "axqbfqywufapstiktmcn";
const PROD = "dxobukushgxuciqhgrpf";

function serveurRepond(charge: unknown, ok = true, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok,
    status,
    json: async () => charge,
  })));
}

afterEach(() => vi.unstubAllGlobals());

describe("cibleDuServeurConfirmee", () => {
  it("accepte un serveur qui vise la base déclarée", async () => {
    serveurRepond({ projectRef: DEV });
    await expect(cibleDuServeurConfirmee("http://localhost:3000", DEV)).resolves.toBeUndefined();
  });

  it("refuse un serveur pointé sur la production", async () => {
    // Le trou qu'on ferme : Playwright réutilise un « npm run dev » ordinaire,
    // qui lit .env.local. Le processus de test, lui, voit bien le dev.
    serveurRepond({ projectRef: PROD });
    await expect(cibleDuServeurConfirmee("http://localhost:3000", DEV)).rejects.toThrow(
      /ConstructionIOS-Production/,
    );
  });

  it("refuse un serveur qui vise une autre base que celle déclarée", async () => {
    serveurRepond({ projectRef: "unautreprojetxyz" });
    await expect(cibleDuServeurConfirmee("http://localhost:3000", DEV)).rejects.toThrow(
      /une autre base/,
    );
  });

  it("refuse un point de contrôle injoignable", async () => {
    // Sans réponse on ne sait pas où l'on écrit, et « on ne sait pas » doit se
    // comporter comme « non ».
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    await expect(cibleDuServeurConfirmee("http://localhost:3000", DEV)).rejects.toThrow(
      /injoignable/,
    );
  });

  it("refuse un point de contrôle absent (404)", async () => {
    serveurRepond(null, false, 404);
    await expect(cibleDuServeurConfirmee("http://localhost:3000", DEV)).rejects.toThrow(/404/);
  });

  it("refuse un serveur qui ne déclare aucun projet", async () => {
    serveurRepond({ projectRef: null });
    await expect(cibleDuServeurConfirmee("http://localhost:3000", DEV)).rejects.toThrow(
      /aucun projet/,
    );
  });
});
