import { describe, expect, it, vi } from "vitest";

import {
  buildSessionSnapshotForAudienceFromSurfaces,
  getValidatedSessionForAudienceFromSurfaces,
  getValidatedSessionFromSurfaces,
  type AuthSession,
  type ResolvedAuthSurface,
} from "../../../src/adapters/http/edge";
import { UserNotFoundError } from "../../../src/errors";

function createAuthSession(input: {
  audience?: "crm" | "finance" | "portal";
  userId?: string;
} = {}): NonNullable<AuthSession> {
  return {
    session: {
      audience: input.audience ?? "crm",
      expiresAt: "2026-01-01T00:00:00.000Z",
      id: "session-1",
      userId: input.userId ?? "user-1",
    },
    user: {
      email: "user@example.com",
      id: input.userId ?? "user-1",
      image: null,
      name: "User",
    },
  } as NonNullable<AuthSession>;
}

function createAuthByAudience(input: Partial<Record<string, AuthSession>>) {
  const createSurface = (
    audience: "crm" | "finance" | "portal",
  ): ResolvedAuthSurface => ({
    api: {
      getSession: vi.fn(async () => input[audience] ?? null),
    },
    handler: vi.fn(async () => new Response(null, { status: 200 })),
  });

  return {
    crm: createSurface("crm"),
    finance: createSurface("finance"),
    portal: createSurface("portal"),
  } satisfies Record<"crm" | "finance" | "portal", ResolvedAuthSurface>;
}

describe("IAM HTTP edge helpers", () => {
  it("returns the requested audience session when the header matches", async () => {
    const authByAudience = createAuthByAudience({
      crm: createAuthSession({ audience: "crm" }),
    });

    const result = await getValidatedSessionForAudienceFromSurfaces({
      audience: "crm",
      authByAudience,
      headers: new Headers(),
    });

    expect(result?.session.audience).toBe("crm");
  });

  it("rejects a session when the stored audience mismatches the request", async () => {
    const authByAudience = createAuthByAudience({
      crm: createAuthSession({ audience: "finance" }),
    });

    const result = await getValidatedSessionForAudienceFromSurfaces({
      audience: "crm",
      authByAudience,
      headers: new Headers(),
    });

    expect(result).toBeNull();
  });

  it("detects the unique audience when no header is supplied", async () => {
    const financeSession = createAuthSession({ audience: "finance" });
    const authByAudience = createAuthByAudience({
      finance: financeSession,
    });

    const result = await getValidatedSessionFromSurfaces({
      authByAudience,
      headers: new Headers(),
    });

    expect(result).toEqual({
      audience: "finance",
      session: financeSession,
    });
  });

  it("returns an anonymous snapshot when no validated session exists", async () => {
    const snapshot = await buildSessionSnapshotForAudienceFromSurfaces({
      audience: "crm",
      authByAudience: createAuthByAudience({}),
      getPortalProfile: vi.fn(),
      headers: new Headers(),
      iamService: {
        queries: {
          findById: vi.fn(),
        },
      } as any,
    });

    expect(snapshot).toMatchObject({
      audience: "crm",
      canAccessDashboard: false,
      isAuthenticated: false,
      user: null,
    });
  });

  it("builds an authenticated portal snapshot from IAM and portal profile data", async () => {
    const authByAudience = createAuthByAudience({
      portal: createAuthSession({ audience: "portal", userId: "user-42" }),
    });
    const getPortalProfile = vi.fn(async () => ({
      customers: [
        {
          description: "Primary account",
          externalRef: "cust-1",
          id: "customer-1",
          name: "Acme",
        },
      ],
      hasCustomerPortalAccess: true,
      hasOnboardingAccess: false,
    }));
    const findById = vi.fn(async () => ({
      banned: false,
      email: "user@example.com",
      emailVerified: true,
      id: "user-42",
      image: null,
      name: "Portal User",
      role: "customer",
      twoFactorEnabled: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      banExpires: null,
      banReason: null,
    }));

    const snapshot = await buildSessionSnapshotForAudienceFromSurfaces({
      audience: "portal",
      authByAudience,
      getPortalProfile,
      headers: new Headers(),
      iamService: {
        queries: {
          findById,
        },
      } as any,
    });

    expect(snapshot).toMatchObject({
      audience: "portal",
      canAccessDashboard: false,
      hasCustomerPortalAccess: true,
      hasOnboardingAccess: false,
      isAuthenticated: true,
      role: "customer",
    });
    expect(getPortalProfile).toHaveBeenCalledWith({ userId: "user-42" });
  });

  it("falls back to anonymous when IAM can no longer resolve the user", async () => {
    const authByAudience = createAuthByAudience({
      finance: createAuthSession({ audience: "finance", userId: "missing" }),
    });

    const snapshot = await buildSessionSnapshotForAudienceFromSurfaces({
      audience: "finance",
      authByAudience,
      getPortalProfile: vi.fn(),
      headers: new Headers(),
      iamService: {
        queries: {
          findById: vi.fn(async () => {
            throw new UserNotFoundError("missing");
          }),
        },
      } as any,
    });

    expect(snapshot).toMatchObject({
      audience: "finance",
      isAuthenticated: false,
      session: null,
      user: null,
    });
  });
});
