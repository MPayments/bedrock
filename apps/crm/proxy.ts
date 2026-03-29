import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { fetchSessionSnapshot, getPreferredHomePath } from "@/lib/auth/access";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await fetchSessionSnapshot({
    cookie: request.headers.get("cookie") ?? "",
  });

  if (pathname.startsWith("/customer")) {
    if (!session.isAuthenticated) {
      return NextResponse.redirect(new URL("/login/customer", request.url));
    }
    if (!session.hasCustomerPortalAccess) {
      return NextResponse.redirect(
        new URL(session.canAccessDashboard ? "/" : "/login/customer", request.url),
      );
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/applications") ||
    pathname.startsWith("/deals") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/reports") ||
    pathname === "/"
  ) {
    if (!session.isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!session.canAccessDashboard) {
      return NextResponse.redirect(
        new URL(getPreferredHomePath(session), request.url),
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/customer/:path*",
    "/applications/:path*",
    "/deals/:path*",
    "/clients/:path*",
    "/calendar/:path*",
    "/reports/:path*",
  ],
};
