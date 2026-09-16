import { test, expect } from "@playwright/test";

/** Un contrôle : le ralentissement s'applique-t-il vraiment ? */
test("le ralentissement est effectif", async ({ page, context }) => {
  const mesurer = async () => {
    const d = Date.now();
    await page.goto("http://localhost:3000/login", { waitUntil: "load" });
    return Date.now() - d;
  };

  const normal = await mesurer();

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });

  const ralenti = await mesurer();
  console.log(`CONTRÔLE >>> normal ${normal} ms · ralenti ${ralenti} ms`);
  expect(ralenti, "le ralentissement doit se voir").toBeGreaterThan(normal * 1.5);
});
