/** Demo company — isolated from real tenant data */
export const DEMO_COMPANY_ID = "demo-company-1";

export const DEMO_USER = {
  id: "demo-user-1",
  email: "admin@constructionios.com",
  firstName: "Admin",
  lastName: "User",
  role: "admin" as const,
  companyId: DEMO_COMPANY_ID,
};

export const DEMO_COMPANY = {
  id: DEMO_COMPANY_ID,
  name: "ConstructionIOS Démo",
  legalName: "ConstructionIOS Démo Inc.",
  logoUrl: null as string | null,
  primaryColor: "#2563eb",
  isDemo: true,
};

export function isDemoLoginEnabled(): boolean {
  return (
    process.env.DEMO_LOGIN_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === "true"
  );
}
