import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/quotes/:path*",
    "/invoices/:path*",
    "/schedule/:path*",
    "/employees/:path*",
    "/payments/:path*",
  ],
};
