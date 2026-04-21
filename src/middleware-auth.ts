// Minimal auth config for Edge middleware — no Prisma, no pg
import NextAuth from "next-auth";

export const { auth } = NextAuth({
  session: { strategy: "jwt" },
  providers: [], // empty for middleware — JWT verification only
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtectedRoute = [
        "/dashboard",
        "/locations",
        "/categories",
        "/products",
        "/pos",
        "/suppliers",
        "/purchase-orders",
        "/reports",
        "/users",
        "/settings",
      ].some((route) => nextUrl.pathname.startsWith(route));

      if (isProtectedRoute && !isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }
      if (nextUrl.pathname === "/login" && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
});
