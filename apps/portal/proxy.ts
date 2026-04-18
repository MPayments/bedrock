import { createAudienceProxy } from "@bedrock/iam/adapters/next";

export const proxy = createAudienceProxy({
  audience: "portal",
  async handle({ getSession, pathname, redirect, next }) {
    const requiresPortalMembership =
      pathname.startsWith("/customers") || pathname.startsWith("/deals");
    const isHandledPath =
      pathname === "/" ||
      pathname === "/login" ||
      pathname.startsWith("/onboard") ||
      requiresPortalMembership;

    if (!isHandledPath) {
      return next();
    }

    const session = await getSession();

    if (!session.isAuthenticated) {
      if (pathname === "/login") {
        return next();
      }

      return redirect("/login");
    }

    if (pathname === "/login" || pathname === "/") {
      return redirect(
        session.hasCustomerPortalAccess ? "/customers" : "/onboard",
      );
    }

    if (pathname.startsWith("/onboard")) {
      if (!session.hasOnboardingAccess && !session.hasCustomerPortalAccess) {
        return redirect("/login");
      }

      if (session.hasCustomerPortalAccess) {
        return redirect("/customers");
      }

      return next();
    }

    if (requiresPortalMembership && !session.hasCustomerPortalAccess) {
      return redirect("/onboard");
    }

    return next();
  },
});

export const config = {
  matcher: [
    "/",
    "/login",
    "/onboard/:path*",
    "/customers/:path*",
    "/deals/:path*",
    "/api/auth/:path*",
    "/v1/:path*",
  ],
};
