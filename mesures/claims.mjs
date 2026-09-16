import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.e2e", "utf8");
const g = (k) =>
  ((env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "");
const m = JSON.parse(readFileSync("mesures/compte.json", "utf8"));

const anon = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false },
});
const { data } = await anon.auth.signInWithPassword({
  email: m.courriel,
  password: m.motDePasse,
});

const ref = g("NEXT_PUBLIC_SUPABASE_URL").match(/https:\/\/([a-z0-9]+)\./)[1];
const valeur =
  "base64-" +
  Buffer.from(
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: "bearer",
      user: data.session.user,
    }),
  ).toString("base64");

const c = createServerClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
  cookies: {
    getAll: () => [{ name: `sb-${ref}-auth-token`, value: valeur }],
    setAll: () => {},
  },
});

const r1 = await c.auth.getClaims();
console.log("getClaims →", JSON.stringify({ data: r1.data ? Object.keys(r1.data) : null, error: r1.error?.message }));
if (r1.data) console.log("  sub :", r1.data.claims?.sub?.slice(0, 8) ?? "(pas de claims.sub)");

console.log("clés des claims :", Object.keys(r1.data.claims).join(", "));
console.log("email_verified :", JSON.stringify(r1.data.claims.email_verified));
console.log("user_metadata  :", JSON.stringify(r1.data.claims.user_metadata ?? null).slice(0, 90));
const r2 = await c.auth.getUser();
console.log("getUser.email_confirmed_at :", r2.data.user?.email_confirmed_at ? "présent" : "absent");
