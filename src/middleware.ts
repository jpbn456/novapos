// Uses middleware-auth.ts which has no Prisma/pg imports — safe for Edge
import { auth } from "@/middleware-auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard =
    req.nextUrl.pathname.startsWith("/dashboard") ||
    req.nextUrl.pathname.startsWith("/locations") ||
    req.nextUrl.pathname.startsWith("/categories") ||
    req.nextUrl.pathname.startsWith("/products") ||
    req.nextUrl.pathname.startsWith("/pos") ||
    req.nextUrl.pathname.startsWith("/suppliers") ||
    req.nextUrl.pathname.startsWith("/purchase-orders") ||
    req.nextUrl.pathname.startsWith("/reports") ||
    req.nextUrl.pathname.startsWith("/promotions") ||
    req.nextUrl.pathname.startsWith("/cash-movements") ||
    req.nextUrl.pathname.startsWith("/inventory-movements") ||
    req.nextUrl.pathname.startsWith("/users") ||
    req.nextUrl.pathname.startsWith("/settings");

  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (req.nextUrl.pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/locations/:path*",
    "/categories/:path*",
    "/products/:path*",
    "/pos/:path*",
    "/suppliers/:path*",
    "/purchase-orders/:path*",
    "/reports/:path*",
    "/promotions/:path*",
    "/cash-movements/:path*",
    "/inventory-movements/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/login",
  ],
};
