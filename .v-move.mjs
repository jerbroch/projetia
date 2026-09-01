import { seed, nettoyer, ouvrir, db, BASE } from "./.bug-base.mjs";
const hh = t => new Date(t).toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"});
console.log("bloc 09:00–13:00 (4 h). On déplace de +64 px = +1 h, en le prenant à trois endroits.\n");
for (const frac of [0.15, 0.5, 0.85]) for (const dx of [64]) {
  const ctx = await seed();
  const { nav, page } = await ouvrir(ctx);
  const { data:c } = await db.from("customers").insert({ company_id:ctx.companyId, name:"A" }).select("id").single();
  const { data:emp } = await db.from("employees").insert({ company_id:ctx.companyId, first_name:"Marc", last_name:"T", trade:"P", status:"active" }).select("id").single();
  const s=new Date(); s.setHours(9,0,0,0); const e=new Date(); e.setHours(13,0,0,0);
  const { data:job } = await db.from("scheduled_jobs").insert({ company_id:ctx.companyId, title:"Bloc",
    customer_id:c.id, customer_name:"A", start_at:s.toISOString(), end_at:e.toISOString(), status:"scheduled",
    employee_ids:[emp.id], employee_names:["Marc T"] }).select("id").single();
  await page.goto(BASE+"/schedule",{waitUntil:"networkidle"}); await page.waitForTimeout(2200);
  const b = page.locator(`[data-event-id="${job.id}"]`).first();
  const bb = await b.boundingBox();
  const x = bb.x + bb.width*frac;
  await page.mouse.move(x, bb.y+bb.height/2); await page.mouse.down();
  await page.mouse.move(x+dx, bb.y+bb.height/2, {steps:20}); await page.mouse.up();
  await page.waitForTimeout(2500);
  const z = (await db.from("scheduled_jobs").select("*").eq("id",job.id).single()).data;
  const dec=(new Date(z.start_at)-s)/60000, dur=(new Date(z.end_at)-new Date(z.start_at))/3.6e6;
  console.log(`prise à ${String(Math.round(frac*100)).padStart(2)}%  →  ${hh(z.start_at)}–${hh(z.end_at)}  décalage ${dec>=0?"+":""}${dec} min (attendu +60)  durée ${dur} h  ${Math.abs(dec-60)<=15?"✓":"✗"}`);
  await nav.close(); await nettoyer(ctx);
}
