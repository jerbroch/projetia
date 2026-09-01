import fs from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.readFileSync(".env.e2e","utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^"|"$/g,""); }
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export const BASE = "http://localhost:3000";
export const MDP = "Chantier!2026xyz";
export const AUJ = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
export const trouvailles = [];
export function bug(g,z,q,a,o,ou="") { trouvailles.push({g,z,q,a,o,ou}); console.log(`  ✗ [${g}] ${q}\n      attendu : ${a}\n      observé : ${o}${ou?`\n      où      : ${ou}`:""}`); }
export function ok(q) { console.log(`  ✓ ${q}`); }
export async function etape(nom, fn) {
  try { await fn(); } catch (e) { const m=String(e.message||e).split("\n")[0].slice(0,150); console.log(`  ⚠ « ${nom} » interrompue : ${m}`); etape.echecs.push(nom); }
}
etape.echecs = [];
export async function fermerDialogues(page) {
  for (let i=0;i<4;i++){ if(!(await page.locator('[role="dialog"]').count())) break; await page.keyboard.press("Escape"); await page.waitForTimeout(350); }
}
export async function seed(nom="beton express") {
  const t=Date.now(), email=`bug-${t}@e2e.constructionios.test`;
  const { data:u, error:eu } = await db.auth.admin.createUser({ email, password:MDP, email_confirm:true });
  if (eu) throw eu;
  const { data:co, error:ec } = await db.from("companies").insert({ name:nom, email,
    subscription_status:"active", access_type:"beta", is_beta:true, promo_code:"ios123",
    requires_access_choice:false, gst_rate:0.05, qst_rate:0.09975 }).select("id").single();
  if (ec) throw ec;
  await db.from("profiles").insert({ id:u.user.id, company_id:co.id, first_name:"Jean", last_name:"Patron", email, role:"owner", status:"active" });
  await db.from("company_members").insert({ company_id:co.id, user_id:u.user.id, role:"owner" });
  return { companyId: co.id, userId: u.user.id, email };
}
export async function nettoyer(ctx) {
  const { data:sh } = await db.from("job_billing_sheets").select("id").eq("company_id", ctx.companyId);
  for (const s of sh ?? []) await db.from("job_billing_lines").delete().eq("billing_sheet_id", s.id);
  for (const tb of ["job_billing_sheets","field_hours","field_materials","job_employee_shifts","tool_sms_reminders",
    "tool_assignments","tools","invoice_payments","invoices","quote_lines","quotes","scheduled_jobs",
    "labor_rate_templates","customers","employees","company_members","profiles"]) {
    await db.from(tb).delete().eq("company_id", ctx.companyId).then(()=>{},()=>{});
  }
  const { data:ps } = await db.from("profiles").select("id").eq("company_id", ctx.companyId);
  for (const p of ps ?? []) await db.auth.admin.deleteUser(p.id).catch(()=>{});
  await db.from("companies").delete().eq("id", ctx.companyId);
  await db.auth.admin.deleteUser(ctx.userId).catch(()=>{});
}
export async function ouvrir(ctx, { mobile=false, email=null } = {}) {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: mobile?{width:390,height:844}:{width:1440,height:1000} });
  const erreurs = [];
  page.on("pageerror", e => erreurs.push(e.message.slice(0,160)));
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email ?? ctx.email);
  await page.fill('input[name="password"]', MDP);
  await page.click('button[type="submit"]');
  await page.waitForURL(u=>!u.pathname.includes("login"), { timeout:30000 }).catch(()=>{});
  return { nav, page, erreurs };
}
