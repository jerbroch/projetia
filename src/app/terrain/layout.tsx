import { requireCompanyAccess } from "@/lib/session";

export default async function TerrainLayout({ children }: { children: React.ReactNode }) {
  await requireCompanyAccess();
  return children;
}
