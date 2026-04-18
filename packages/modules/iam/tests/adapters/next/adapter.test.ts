import { beforeEach, describe, expect, it, vi } from "vitest";

const { nextMock, redirectMock } = vi.hoisted(() => ({
  nextMock: vi.fn((input?: unknown) => ({
    kind: "next",
    input,
  })),
  redirectMock: vi.fn((url: URL) => ({
    kind: "redirect",
    url: url.toString(),
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
    redirect: redirectMock,
  },
}));

import {
  createAudienceProxy,
  fetchAudienceSessionSnapshot,
} from "../../../src/adapters/next";

describe("IAM Next adapters", () => {
  beforeEach(() => {
    nextMock.mockClear();
    redirectMock.mockClear();
  });

  it("falls back to an anonymous snapshot when the session endpoint is unavailable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("unavailable");
    });

    const snapshot = await fetchAudienceSessionSnapshot({
      audience: "crm",
      cookie: "session=1",
      fetchImpl,
    });

    expect(snapshot).toMatchObject({
      audience: "crm",
      canAccessDashboard: false,
      isAuthenticated: false,
      user: null,
    });
  });

  it("injects the audience header when fetching the session snapshot", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          audience: "finance",
          isAuthenticated: true,
          requiresTwoFactorSetup: false,
          role: "admin",
          session: {
            expiresAt: "2026-01-01T00:00:00.000Z",
            id: "session-1",
          },
          user: {
            email: "user@example.com",
            id: "user-1",
            image: null,
            name: "User",
          },
        }),
        { status: 200 },
      ),
    );

    await fetchAudienceSessionSnapshot({
      audience: "finance",
      cookie: "session=1",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/finance/session-snapshot",
      expect.objectContaining({
        headers: expect.objectContaining({
          cookie: "session=1",
          "x-bedrock-app-audience": "finance",
        }),
      }),
    );
  });

  it("passes shared auth routes through with injected headers", async () => {
    const proxy = createAudienceProxy({
      audience: "portal",
      handle: vi.fn(),
    });

    const response = await proxy({
      headers: new Headers(),
      nextUrl: { pathname: "/api/auth/portal/login" },
      url: "http://localhost:3003/api/auth/portal/login",
    } as any);

    expect(response).toEqual({
      kind: "next",
      input: {
        request: {
          headers: expect.any(Headers),
        },
      },
    });
    const headers = nextMock.mock.calls[0]?.[0]?.request?.headers as Headers;
    expect(headers.get("x-bedrock-app-audience")).toBe("portal");
  });

  it("lets the app-local callback decide redirects and session reads", async () => {
    const loadSession = vi.fn(async () => ({
      audience: "crm" as const,
      canAccessDashboard: false,
      customerPortalCustomers: [],
      hasCustomerPortalAccess: false,
      isAuthenticated: false,
      role: null,
      session: null,
      user: null,
    }));
    const proxy = createAudienceProxy({
      audience: "crm",
      handle: async ({ getSession, pathname, redirect }) => {
        const session = await getSession();

        if (pathname === "/" && !session.isAuthenticated) {
          return redirect("/login");
        }

        return null;
      },
      loadSession,
    });

    const response = await proxy({
      headers: new Headers(),
      nextUrl: { pathname: "/" },
      url: "http://localhost:3002/",
    } as any);

    expect(loadSession).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      kind: "redirect",
      url: "http://localhost:3002/login",
    });
  });
});
