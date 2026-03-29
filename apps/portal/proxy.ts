import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { fetchSessionSnapshot } from "@/lib/auth/access";

const CRM_BASE_URL =
  process.env.NEXT_PUBLIC_CRM_URL ?? "http://localhost:3002";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await fetchSessionSnapshot({
    cookie: request.headers.get("cookie") ?? "",
  });

  if (
    pathname === "/" ||
    pathname.startsWith("/onboard") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/applications") ||
    pathname.startsWith("/deals")
  ) {
    if (!session.isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!session.hasCustomerPortalAccess) {
      return NextResponse.redirect(
        session.canAccessDashboard
          ? new URL(CRM_BASE_URL)
          : new URL("/login", request.url),
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/onboard/:path*",
    "/clients/:path*",
    "/applications/:path*",
    "/deals/:path*",
  ],
};
