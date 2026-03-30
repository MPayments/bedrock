import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { fetchSessionSnapshot } from "@/lib/auth/access";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await fetchSessionSnapshot({
    cookie: request.headers.get("cookie") ?? "",
  });
  const requiresPortalMembership =
    pathname.startsWith("/clients") ||
    pathname.startsWith("/deals");

  if (
    pathname === "/" ||
    pathname.startsWith("/onboard") ||
    requiresPortalMembership
  ) {
    if (!session.isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname.startsWith("/onboard")) {
      if (session.hasCrmAccess && !session.hasCustomerPortalAccess) {
        return NextResponse.redirect(new URL("/", request.url));
      }

      return NextResponse.next();
    }

    if (requiresPortalMembership && !session.hasCustomerPortalAccess) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/onboard/:path*",
    "/clients/:path*",
    "/deals/:path*",
  ],
};
