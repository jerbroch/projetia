import { seed, nettoyer, ouvrir, db, BASE, fermerDialogues } from "./.bug-base.mjs";
const ctx = await seed();
const { nav, page } = await ouvrir(ctx);
const d = () => page.locator('[role="dialog"]').last();
const creer = async (nom, num) => {
  await fermerDialogues(page);
  await page.goto(BASE+"/outillage",{waitUntil:"networkidle"});
  await page.getByRole("button",{name:/Ajouter un outil/i}).click(); await page.waitForTimeout(1200);
  await d().locator("#name").fill(nom);
  if (num) await d().locator("#internalNumber").fill(num);
  await d().getByRole("button",{name:/^Ajouter$/}).click(); await page.waitForTimeout(2500);
  const msg = await d().innerText().catch(()=>"");
  const err = msg.split("\n").map(s=>s.trim()).filter(s=>/déjà porté|Choisissez/i.test(s));
  const toast = await page.locator('[data-sonner-toast],[role="status"],[role="alert"]').allInnerTexts().catch(()=>[]);
  await fermerDialogues(page);
  return { dialogue: err, toast };
};
await creer("Scie ronde Makita","OUT-001");
const m = await creer("Deuxième scie","out-001");   // casse différente exprès
console.log("message au 2e essai — dialogue :", JSON.stringify(m.dialogue), " toast :", JSON.stringify(m.toast));
const n = (await db.from("tools").select("name,internal_number").eq("company_id",ctx.companyId)).data ?? [];
console.log("outils en base :", n.map(o=>`${o.name}[${o.internal_number}]`).join(" · "));
console.log(n.filter(o=>(o.internal_number||"").toLowerCase()==="out-001").length===1 ? "✓ doublon refusé" : "✗ DOUBLON CRÉÉ");
const v = await creer("Échelle 24 pi","");
const v2 = await creer("Pompe","");
console.log((await db.from("tools").select("id").eq("company_id",ctx.companyId)).data.length===3 ? "✓ deux outils sans numéro coexistent" : "✗ numéro vide traité comme conflit");
await nav.close(); await nettoyer(ctx);
