import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { Company, User } from "@/types";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  company: Company;
  user: User;
  isDemo?: boolean;
  hideHeaderSearch?: boolean;
}

export function DashboardLayout({
  children,
  title,
  description,
  company,
  user,
  isDemo,
  hideHeaderSearch,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar company={company} isDemo={isDemo} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={title}
          description={description}
          user={user}
          company={company}
          isDemo={isDemo}
          hideSearch={hideHeaderSearch}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
