import { PortalSessionSnapshotSchema } from "@bedrock/iam/contracts";

import type { UserSessionSnapshot } from "./types";

export function createAnonymousSessionSnapshot(): UserSessionSnapshot {
  return PortalSessionSnapshotSchema.parse({
    audience: "portal",
    canAccessDashboard: false,
    customerPortalCustomers: [],
    hasOnboardingAccess: false,
    hasCustomerPortalAccess: false,
    isAuthenticated: false,
    role: null,
    session: null,
    user: null,
  });
}

export async function fetchSessionSnapshot(input: {
  apiUrl?: string;
  cookie: string;
}): Promise<UserSessionSnapshot> {
  const apiUrl =
    input.apiUrl ??
    process.env.API_INTERNAL_URL ??
    "http://localhost:3000";
  let sessionResponse: Response;

  try {
    sessionResponse = await fetch(`${apiUrl}/api/auth/portal/session-snapshot`, {
      cache: "no-store",
      headers: {
        cookie: input.cookie,
        "x-bedrock-app-audience": "portal",
      },
    });
  } catch {
    return createAnonymousSessionSnapshot();
  }

  if (!sessionResponse.ok) {
    return createAnonymousSessionSnapshot();
  }

  const sessionPayload = await sessionResponse.json();
  const parsedSession = PortalSessionSnapshotSchema.safeParse(sessionPayload);

  if (!parsedSession.success) {
    return createAnonymousSessionSnapshot();
  }

  return parsedSession.data;
}
