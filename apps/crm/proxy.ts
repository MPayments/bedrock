import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function getSessionRole(request: NextRequest): Promise<string | null> {
  try {
    const cookie = request.headers.get("cookie") ?? "";
    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.user) return null;

    if (data.user.role === "customer") return "customer";
    if (data.user.role === "admin" || data.user.isAdmin) return "admin";
    return "agent";
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = await getSessionRole(request);

  // Customer routes - only customers allowed
  if (pathname.startsWith("/customer")) {
    if (!role) {
      return NextResponse.redirect(new URL("/login/customer", request.url));
    }
    if (role !== "customer") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Dashboard routes - admins and agents only
  if (
    pathname.startsWith("/applications") ||
    pathname.startsWith("/deals") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/reports") ||
    pathname === "/"
  ) {
    if (!role) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (role === "customer") {
      return NextResponse.redirect(new URL("/customer", request.url));
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
