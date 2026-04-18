import { createAudienceProxy } from "@bedrock/iam/adapters/next";

const PROTECTED_PREFIXES = ["/deals", "/customers", "/calendar", "/reports"];

export const proxy = createAudienceProxy({
  audience: "crm",
  async handle({ getSession, pathname, redirect, next }) {
    const isProtectedPath =
      pathname === "/" ||
      PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

    if (!isProtectedPath) {
      return next();
    }

    const session = await getSession();
    if (!session.isAuthenticated || !session.canAccessDashboard) {
      return redirect("/login");
    }

    return next();
  },
});

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
