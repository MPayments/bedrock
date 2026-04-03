import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { fetchSessionSnapshot } from "@/lib/auth/access";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const audienceHeaders = new Headers(request.headers);
  audienceHeaders.set("x-bedrock-app-audience", "portal");

  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/v1/")) {
    return NextResponse.next({
      request: {
        headers: audienceHeaders,
      },
    });
  }

  const session = await fetchSessionSnapshot({
    cookie: request.headers.get("cookie") ?? "",
  });
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));
  const requiresPortalMembership =
    pathname.startsWith("/clients") ||
    pathname.startsWith("/deals");

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/onboard") ||
    requiresPortalMembership
  ) {
    if (!session.isAuthenticated) {
      if (pathname === "/login") {
        return NextResponse.next();
      }

      return redirectTo("/login");
    }

    if (pathname === "/login") {
      return redirectTo(
        session.hasCustomerPortalAccess ? "/clients" : "/onboard",
      );
    }

    if (pathname === "/") {
      return redirectTo(
        session.hasCustomerPortalAccess ? "/clients" : "/onboard",
      );
    }

    if (pathname.startsWith("/onboard")) {
      if (!session.hasOnboardingAccess && !session.hasCustomerPortalAccess) {
        return redirectTo("/login");
      }

      if (session.hasCustomerPortalAccess) {
        return redirectTo("/clients");
      }

      return NextResponse.next();
    }

    if (requiresPortalMembership && !session.hasCustomerPortalAccess) {
      return redirectTo("/onboard");
    }
  }

  return NextResponse.next({
    request: {
      headers: audienceHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/onboard/:path*",
    "/clients/:path*",
    "/deals/:path*",
    "/api/auth/:path*",
    "/v1/:path*",
  ],
};
