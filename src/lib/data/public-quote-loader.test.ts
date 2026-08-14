import { describe, expect, it } from "vitest";
import { loadDemoPublicQuote, loadPublicQuote } from "@/lib/data/public-quote-loader";

describe("loadDemoPublicQuote", () => {
  it("loads a demo quote by demo-{id} token", async () => {
    const result = await loadDemoPublicQuote("demo-quote-2");
    expect(result?.success).toBe(true);
    if (!result?.success) return;

    expect(result.quote.id).toBe("quote-2");
    expect(result.company.name).toBe("Construction Démo Inc.");
  });

  it("returns null for non-demo tokens", async () => {
    await expect(loadDemoPublicQuote("not-a-demo-token")).resolves.toBeNull();
  });
});

describe("loadPublicQuote", () => {
  it("rejects tokens that are too short", async () => {
    const result = await loadPublicQuote("short");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Lien invalide.");
  });
});
