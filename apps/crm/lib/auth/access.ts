import { CrmSessionSnapshotSchema } from "@bedrock/iam/contracts";

import type { UserSessionSnapshot } from "./types";

function createAnonymousSessionSnapshot(): UserSessionSnapshot {
  return CrmSessionSnapshotSchema.parse({
    audience: "crm",
    canAccessDashboard: false,
    customerPortalCustomers: [],
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
    sessionResponse = await fetch(`${apiUrl}/api/auth/crm/session-snapshot`, {
      cache: "no-store",
      headers: {
        cookie: input.cookie,
        "x-bedrock-app-audience": "crm",
      },
    });
  } catch {
    return createAnonymousSessionSnapshot();
  }

  if (!sessionResponse.ok) {
    return createAnonymousSessionSnapshot();
  }

  const sessionPayload = await sessionResponse.json();
  const parsedSession = CrmSessionSnapshotSchema.safeParse(sessionPayload);

  if (!parsedSession.success) {
    return createAnonymousSessionSnapshot();
  }

  return parsedSession.data;
}
