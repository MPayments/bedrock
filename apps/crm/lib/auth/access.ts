import { z } from "zod";

import type { CrmRole, UserSessionSnapshot } from "./types";

const SessionResponseSchema = z.looseObject({
  session: z.looseObject({
    id: z.string(),
    expiresAt: z.string().nullable().optional(),
  }),
  user: z.looseObject({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable().optional(),
    role: z.string().optional(),
    isAdmin: z.boolean().optional(),
  }),
});

const CustomerPortalProfileSchema = z.object({
  customers: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      externalRef: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
    }),
  ),
  hasCustomerPortalAccess: z.boolean(),
});

export function resolveRole(user: {
  role?: string;
  isAdmin?: boolean;
}): CrmRole {
  if (user.role === "customer") return "customer";
  if (user.role === "admin" || user.isAdmin) return "admin";
  return "agent";
}

export function createAnonymousSessionSnapshot(): UserSessionSnapshot {
  return {
    canAccessDashboard: false,
    customerPortalCustomers: [],
    hasCustomerPortalAccess: false,
    isAuthenticated: false,
    role: "agent",
    session: null,
    user: null,
  };
}

export function getPreferredHomePath(session: UserSessionSnapshot): string {
  if (session.canAccessDashboard) return "/";
  if (session.hasCustomerPortalAccess) return "/customer";
  return "/login/customer";
}

export async function fetchSessionSnapshot(input: {
  apiUrl?: string;
  cookie: string;
}): Promise<UserSessionSnapshot> {
  const apiUrl = input.apiUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const sessionResponse = await fetch(`${apiUrl}/api/auth/get-session`, {
    cache: "no-store",
    headers: {
      cookie: input.cookie,
    },
  });

  if (!sessionResponse.ok) {
    return createAnonymousSessionSnapshot();
  }

  const sessionPayload = await sessionResponse.json();
  const parsedSession = SessionResponseSchema.safeParse(sessionPayload);

  if (!parsedSession.success) {
    return createAnonymousSessionSnapshot();
  }

  const role = resolveRole(parsedSession.data.user);
  let hasCustomerPortalAccess = false;
  let customerPortalCustomers: UserSessionSnapshot["customerPortalCustomers"] =
    [];

  try {
    const customerProfileResponse = await fetch(
      `${apiUrl}/v1/operations/customer/profile`,
      {
        cache: "no-store",
        headers: {
          cookie: input.cookie,
        },
      },
    );

    if (customerProfileResponse.ok) {
      const profilePayload = await customerProfileResponse.json();
      const parsedProfile = CustomerPortalProfileSchema.safeParse(profilePayload);
      if (parsedProfile.success) {
        hasCustomerPortalAccess = parsedProfile.data.hasCustomerPortalAccess;
        customerPortalCustomers = parsedProfile.data.customers.map((customer) => ({
          description: customer.description ?? null,
          displayName: customer.displayName,
          externalRef: customer.externalRef ?? null,
          id: customer.id,
        }));
      }
    }
  } catch {
    // Keep the auth session valid even if the portal capability check fails.
  }

  return {
    canAccessDashboard: role !== "customer",
    customerPortalCustomers,
    hasCustomerPortalAccess,
    isAuthenticated: true,
    role,
    session: {
      id: parsedSession.data.session.id,
      expiresAt: parsedSession.data.session.expiresAt ?? null,
    },
    user: {
      email: parsedSession.data.user.email,
      id: parsedSession.data.user.id,
      image: parsedSession.data.user.image ?? null,
      isAdmin: parsedSession.data.user.isAdmin,
      name: parsedSession.data.user.name,
    },
  };
}
