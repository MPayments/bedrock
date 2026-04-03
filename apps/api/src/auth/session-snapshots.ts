import { UserNotFoundError } from "@bedrock/iam";
import {
  CrmSessionSnapshotSchema,
  FinanceAuthSessionSnapshotSchema,
  PortalSessionSnapshotSchema,
  type AuthAudience,
} from "@bedrock/iam/contracts";

import { getValidatedSessionForAudience } from "./index";
import type { AppContext } from "../context";

function mapSession(input: {
  expiresAt?: Date | string | null;
  id: string;
} | null) {
  if (!input) {
    return null;
  }

  return {
    expiresAt:
      input.expiresAt instanceof Date
        ? input.expiresAt.toISOString()
        : input.expiresAt ?? null,
    id: input.id,
  };
}

function mapUser(input: {
  email: string;
  id: string;
  image?: string | null;
  name: string;
} | null) {
  if (!input) {
    return null;
  }

  return {
    email: input.email,
    id: input.id,
    image: input.image ?? null,
    name: input.name,
  };
}

async function findCurrentUser(ctx: AppContext, userId: string) {
  try {
    return await ctx.iamService.queries.findById(userId);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return null;
    }

    throw error;
  }
}

function createAnonymousCrmSnapshot() {
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

function createAnonymousPortalSnapshot() {
  return PortalSessionSnapshotSchema.parse({
    audience: "portal",
    canAccessDashboard: false,
    customerPortalCustomers: [],
    hasCustomerPortalAccess: false,
    hasOnboardingAccess: false,
    isAuthenticated: false,
    role: null,
    session: null,
    user: null,
  });
}

function createAnonymousFinanceSnapshot() {
  return FinanceAuthSessionSnapshotSchema.parse({
    audience: "finance",
    isAuthenticated: false,
    requiresTwoFactorSetup: false,
    role: "finance",
    session: null,
    user: null,
  });
}

function mapCustomerSummaries(customers: {
  description: string | null;
  displayName: string;
  externalRef: string | null;
  id: string;
}[]) {
  return customers.map((customer) => ({
    description: customer.description,
    displayName: customer.displayName,
    externalRef: customer.externalRef,
    id: customer.id,
  }));
}

export async function buildSessionSnapshotForAudience(input: {
  audience: AuthAudience;
  ctx: AppContext;
  headers: Headers;
}) {
  const authSession = await getValidatedSessionForAudience({
    audience: input.audience,
    headers: input.headers,
  });

  if (!authSession) {
    if (input.audience === "crm") {
      return createAnonymousCrmSnapshot();
    }

    if (input.audience === "portal") {
      return createAnonymousPortalSnapshot();
    }

    return createAnonymousFinanceSnapshot();
  }

  const currentUser = await findCurrentUser(input.ctx, authSession.user.id);
  if (!currentUser) {
    if (input.audience === "crm") {
      return createAnonymousCrmSnapshot();
    }

    if (input.audience === "portal") {
      return createAnonymousPortalSnapshot();
    }

    return createAnonymousFinanceSnapshot();
  }

  if (input.audience === "finance") {
    return FinanceAuthSessionSnapshotSchema.parse({
      audience: "finance",
      isAuthenticated: true,
      requiresTwoFactorSetup: !currentUser.twoFactorEnabled,
      role: currentUser.role === "admin" ? "admin" : "finance",
      session: mapSession(authSession.session),
      user: mapUser(authSession.user),
    });
  }

  const profile = await input.ctx.customerPortalWorkflow.getProfile({
    userId: authSession.user.id,
  });

  if (input.audience === "crm") {
    return CrmSessionSnapshotSchema.parse({
      audience: "crm",
      canAccessDashboard: true,
      customerPortalCustomers: mapCustomerSummaries(profile.customers),
      hasCustomerPortalAccess: profile.hasCustomerPortalAccess,
      isAuthenticated: true,
      role: currentUser.role === "admin" ? "admin" : "agent",
      session: mapSession(authSession.session),
      user: mapUser(authSession.user),
    });
  }

  return PortalSessionSnapshotSchema.parse({
    audience: "portal",
    canAccessDashboard:
      currentUser.role === "admin" || currentUser.role === "agent",
    customerPortalCustomers: mapCustomerSummaries(profile.customers),
    hasCustomerPortalAccess: profile.hasCustomerPortalAccess,
    hasOnboardingAccess: profile.hasOnboardingAccess,
    isAuthenticated: true,
    role: currentUser.role,
    session: mapSession(authSession.session),
    user: mapUser(authSession.user),
  });
}
