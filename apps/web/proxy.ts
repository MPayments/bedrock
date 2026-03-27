import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

import { resolveInternalApiUrl } from "./lib/api/internal-base-url";

const PUBLIC_PATHS = new Set(["/login", "/two-factor"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return redirectToLogin(request, pathname);
  }

  try {
    const res = await fetch(resolveInternalApiUrl("/api/auth/get-session"), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (!res.ok) {
      return redirectToLogin(request, pathname);
    }
  } catch {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|v1/).*)",
  ],
};
