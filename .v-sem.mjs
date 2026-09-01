import { seed, nettoyer, ouvrir, db, BASE } from "./.bug-base.mjs";
const ctx = await seed();
const { nav, page } = await ouvrir(ctx);
await page.goto(BASE+"/schedule",{waitUntil:"networkidle"}); await page.waitForTimeout(1500);
const sem = page.getByRole("button",{name:/^Semaine$/});
if (await sem.count()) { await sem.click(); await page.waitForTimeout(2000); }
const t = await page.locator("main").innerText();
console.log("en-tête :", t.split("\n").map(x=>x.trim()).find(x=>/Semaine du/.test(x)) ?? "?");
const fr = (t.match(/\b(lun|mar|mer|jeu|ven|sam|dim)\.? ?\d+/gi)||[]);
const en = (t.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+/g)||[]);
console.log("jours en français :", fr.slice(0,7).join(" · ") || "aucun");
console.log("jours en anglais  :", en.slice(0,7).join(" · ") || "aucun ✓");
await nav.close(); await nettoyer(ctx);
