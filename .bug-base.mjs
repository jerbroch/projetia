import fs from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.readFileSync(".env.e2e","utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^"|"$/g,""); }
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export const BASE="http://localhost:3000"; export const MDP="Chantier!2026xyz";
export const AUJ = () => new Date().toLocaleDateString("en-CA",{timeZone:"America/Toronto"});
export const norm = x => String(x).replace(/[    ⁠]/g," ");
export const trouvailles = [];
export function ok(q){console.log(`  ✓ ${q}`);}
export function bug(g,q,a,o){trouvailles.push({g,q});console.log(`  ✗ [${g}] ${q}\n      attendu : ${a}\n      observé : ${o}`);}
export async function etape(n,f){ try{ await f(); }catch(e){ console.log(`  ⚠ « ${n} » interrompue : ${String(e.message||e).split("\n")[0].slice(0,140)}`);} }
export async function fermerDialogues(page){ for(let i=0;i<4;i++){ if(!(await page.locator('[role="dialog"]').count()))break; await page.keyboard.press("Escape"); await page.waitForTimeout(300);} }
export async function seed(){ const t=Date.now(), email=`bug-${t}@e2e.constructionios.test`;
  const { data:u } = await db.auth.admin.createUser({ email, password:MDP, email_confirm:true });
  const { data:co } = await db.from("companies").insert({ name:"Toiture Bélanger inc.", email:"info@belanger.ca",
    phone:"418-555-0199", subscription_status:"active", access_type:"beta", is_beta:true, promo_code:"ios123",
    requires_access_choice:false, gst_rate:0.05, qst_rate:0.09975 }).select("id").single();
  await db.from("profiles").insert({ id:u.user.id, company_id:co.id, first_name:"J", last_name:"P", email, role:"owner", status:"active" });
  await db.from("company_members").insert({ company_id:co.id, user_id:u.user.id, role:"owner" });
  return { companyId:co.id, userId:u.user.id, email }; }
export async function nettoyer(ctx){
  const { data:sh } = await db.from("job_billing_sheets").select("id").eq("company_id",ctx.companyId);
  for (const x of sh??[]) await db.from("job_billing_lines").delete().eq("billing_sheet_id",x.id);
  const { data:ps } = await db.from("profiles").select("id").eq("company_id",ctx.companyId);
  for (const tb of ["job_billing_sheets","field_hours","field_materials","payments","invoices","quotes",
    "tool_assignments","tools","scheduled_jobs","employee_roles","labor_rate_templates","customers","employees","company_members","profiles"])
    await db.from(tb).delete().eq("company_id",ctx.companyId).then(()=>{},()=>{});
  for (const p of ps??[]) await db.auth.admin.deleteUser(p.id).catch(()=>{});
  await db.from("companies").delete().eq("id",ctx.companyId); await db.auth.admin.deleteUser(ctx.userId).catch(()=>{}); }
export async function ouvrir(ctx,{mobile=false,email=null}={}){ const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: mobile?{width:390,height:844}:{width:1440,height:1000} });
  const erreurs=[]; page.on("pageerror",e=>erreurs.push(e.message.slice(0,150)));
  await page.goto(`${BASE}/login`); await page.fill('input[name="email"]', email ?? ctx.email);
  await page.fill('input[name="password"]',MDP); await page.click('button[type="submit"]');
  await page.waitForURL(u=>!u.pathname.includes("login"),{timeout:30000}).catch(()=>{});
  return { nav, page, erreurs }; }
export async function chantier(ctx, { heures=27.5, materiau=true } = {}) {
  const { data:c } = await db.from("customers").insert({ company_id:ctx.companyId, name:"Marie Gagnon",
    email:"marie@videotron.ca", address:"118, rue Saint-Joseph, Lévis" }).select("id").single();
  const { data:emp } = await db.from("employees").insert({ company_id:ctx.companyId, first_name:"Marc",
    last_name:"Tremblay", trade:"Couvreur", status:"active", hourly_rate:35 }).select("id").single();
  const { data:gab } = await db.from("labor_rate_templates").insert({ company_id:ctx.companyId,
    name:"Couvreur", worker_count:1, cost_per_hr:62, bill_rate:125, is_active:true, rate_type:"regular", sort_order:1 }).select("id,name,bill_rate").single();
  const s=new Date(); s.setHours(7,0,0,0); const e=new Date(); e.setHours(17,0,0,0);
  const { data:job } = await db.from("scheduled_jobs").insert({ company_id:ctx.companyId, title:"Réfection toiture",
    customer_id:c.id, customer_name:"Marie Gagnon", job_site_address:"118, rue Saint-Joseph, Lévis",
    start_at:s.toISOString(), end_at:e.toISOString(), status:"ready-to-invoice",
    employee_ids:[emp.id], employee_names:["Marc Tremblay"], quote_estimation_snapshot:{ estimatedHours: 24 } }).select("id").single();
  await db.from("field_hours").insert({ company_id:ctx.companyId, scheduled_job_id:job.id, employee_id:emp.id, work_date:AUJ(), hours:heures });
  if (materiau) await db.from("field_materials").insert({ company_id:ctx.companyId, scheduled_job_id:job.id,
    employee_id:emp.id, name:"Bardeau IKO Cambridge", quantity:12, unit:"paquet" });
  return { customer:c, employee:emp, gabarit:gab, job };
}
export async function feuilleFraiche(page, jobId) {
  await fermerDialogues(page);
  await page.goto(BASE+"/schedule",{waitUntil:"networkidle"}); await page.waitForTimeout(2000);
  await page.locator(`[data-event-id="${jobId}"]`).first().click(); await page.waitForTimeout(1600);
  await page.locator('[role="dialog"]').last().getByRole("button",{name:/Voir \/ Générer la facture/}).click();
  await page.waitForTimeout(5000);
  return page.locator('[role="dialog"]').filter({ hasText:"Facturation" }).last();
}
