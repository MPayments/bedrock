import {
  CrmSessionSnapshotSchema,
  FinanceAuthSessionSnapshotSchema,
  PortalSessionSnapshotSchema,
  type AppSession,
  type AppSessionUser,
  type AuthAudience,
  type CrmSessionSnapshot,
  type FinanceAuthSessionSnapshot,
  type PortalSessionSnapshot,
} from "../../contracts";

export interface PortalProfileCustomerSummary {
  description: string | null;
  externalRef: string | null;
  id: string;
  name: string;
}

export interface PortalProfileSnapshot {
  customers: PortalProfileCustomerSummary[];
  hasCustomerPortalAccess: boolean;
  hasOnboardingAccess: boolean;
}

export interface SessionSnapshotByAudience {
  crm: CrmSessionSnapshot;
  finance: FinanceAuthSessionSnapshot;
  portal: PortalSessionSnapshot;
}

export function mapSession(input: {
  expiresAt?: Date | string | null;
  id: string;
} | null): AppSession | null {
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

export function mapUser(input: {
  email: string;
  id: string;
  image?: string | null;
  name: string;
} | null): AppSessionUser | null {
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

export function mapCustomerSummaries(customers: PortalProfileCustomerSummary[]) {
  return customers.map((customer) => ({
    description: customer.description,
    externalRef: customer.externalRef,
    id: customer.id,
    name: customer.name,
  }));
}

export function createAnonymousSessionSnapshot<Audience extends AuthAudience>(
  audience: Audience,
): SessionSnapshotByAudience[Audience] {
  if (audience === "crm") {
    return CrmSessionSnapshotSchema.parse({
      audience: "crm",
      canAccessDashboard: false,
      customerPortalCustomers: [],
      hasCustomerPortalAccess: false,
      isAuthenticated: false,
      role: null,
      session: null,
      user: null,
    }) as SessionSnapshotByAudience[Audience];
  }

  if (audience === "portal") {
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
    }) as SessionSnapshotByAudience[Audience];
  }

  return FinanceAuthSessionSnapshotSchema.parse({
    audience: "finance",
    isAuthenticated: false,
    requiresTwoFactorSetup: false,
    role: "finance",
    session: null,
    user: null,
  }) as SessionSnapshotByAudience[Audience];
}

export function parseSessionSnapshot<Audience extends AuthAudience>(
  audience: Audience,
  payload: unknown,
): SessionSnapshotByAudience[Audience] | null {
  if (audience === "crm") {
    const parsed = CrmSessionSnapshotSchema.safeParse(payload);
    return parsed.success
      ? (parsed.data as SessionSnapshotByAudience[Audience])
      : null;
  }

  if (audience === "portal") {
    const parsed = PortalSessionSnapshotSchema.safeParse(payload);
    return parsed.success
      ? (parsed.data as SessionSnapshotByAudience[Audience])
      : null;
  }

  const parsed = FinanceAuthSessionSnapshotSchema.safeParse(payload);
  return parsed.success
    ? (parsed.data as SessionSnapshotByAudience[Audience])
    : null;
}
