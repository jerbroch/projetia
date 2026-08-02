import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config shared by middleware and the full auth instance.
 * Keep this file free of Node-only imports (mock data, database adapters, etc.).
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
      const isProtected =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/customers") ||
        nextUrl.pathname.startsWith("/quotes") ||
        nextUrl.pathname.startsWith("/invoices") ||
        nextUrl.pathname.startsWith("/schedule") ||
        nextUrl.pathname.startsWith("/employees") ||
        nextUrl.pathname.startsWith("/payments");

      if (isProtected) {
        return isLoggedIn;
      }

      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as string | undefined) ?? "employee";
        session.user.companyId = (token.companyId as string | undefined) ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
