import { getSessionCookie } from "better-auth/cookies";

import { createAudienceProxy } from "@bedrock/iam/adapters/next";

const PUBLIC_PATHS = new Set(["/login", "/two-factor"]);

export const proxy = createAudienceProxy({
  audience: "finance",
  async handle({ getSession, pathname, redirect, request, next }) {
    if (PUBLIC_PATHS.has(pathname)) {
      return next();
    }

    const sessionCookie = getSessionCookie(request, {
      cookiePrefix: "bedrock-finance",
    });
    if (!sessionCookie) {
      return redirectToLogin(redirect, pathname);
    }

    const session = await getSession();
    if (!session.isAuthenticated) {
      return redirectToLogin(redirect, pathname);
    }

    return next();
  },
});

function redirectToLogin(redirect: (path: string) => Response, pathname: string) {
  return redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
