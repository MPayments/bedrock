import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATHS = new Set(["/login", "/two-factor"]);
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bedrock-app-audience", "finance");

  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/v1/")) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: "bedrock-finance",
  });
  if (!sessionCookie) {
    return redirectToLogin(request, pathname);
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/finance/get-session`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "x-bedrock-app-audience": "finance",
      },
    });
    if (!res.ok) {
      return redirectToLogin(request, pathname);
    }

    const payload = await res.json().catch(() => null);
    if (
      !payload ||
      typeof payload !== "object" ||
      !("session" in payload) ||
      !("user" in payload)
    ) {
      return redirectToLogin(request, pathname);
    }
  } catch {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
