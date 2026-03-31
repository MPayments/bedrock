import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { fetchSessionSnapshot } from "@/lib/auth/access";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const audienceHeaders = new Headers(request.headers);
  audienceHeaders.set("x-bedrock-app-audience", "crm");

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

  if (
    pathname.startsWith("/deals") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/reports") ||
    pathname === "/"
  ) {
    if (!session.isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
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
    "/deals/:path*",
    "/customers/:path*",
    "/calendar/:path*",
    "/reports/:path*",
    "/api/auth/:path*",
    "/v1/:path*",
  ],
};
