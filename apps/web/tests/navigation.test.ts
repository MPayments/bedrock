import { describe, expect, it } from "vitest";

import {
  getPrimaryNavigation,
  getSecondaryNavigation,
} from "@/lib/navigation/config";
import type { UserSessionSnapshot } from "@/lib/auth/types";

function createSession(role: "user" | "admin"): UserSessionSnapshot {
  return {
    isAuthenticated: true,
    role,
    featureFlags: {},
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      image: null,
    },
    session: {
      id: "session-1",
      expiresAt: null,
    },
  };
}

describe("navigation config", () => {
  it("hides admin-only sections for regular users", () => {
    const items = getPrimaryNavigation(createSession("user"));

    expect(items.map((item) => item.href)).toEqual([
      "/",
      "/transfers",
      "/documents",
      "/settings",
    ]);
  });

  it("shows admin sections and no dead placeholder links", () => {
    const items = getPrimaryNavigation(createSession("admin"));
    const hrefs = items.flatMap((item) => [
      item.href,
      ...(item.children ?? []).map((child) => child.href),
    ]);

    expect(hrefs).toContain("/accounting");
    expect(hrefs).toContain("/documents/journal");
    expect(hrefs).toContain("/entities");
    expect(hrefs).toContain("/fx");
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/settings/system");
    expect(hrefs).toContain("/settings/profile");
    expect(hrefs).toContain("/treasury");
    expect(hrefs).toContain("/users");
    expect(hrefs).not.toContain("/operations");
    expect(hrefs).not.toContain("#");
    expect(hrefs).not.toContain("/fx/quotes");
    expect(hrefs).not.toContain("/treasury/counterparty-accounts");
  });

  it("keeps secondary navigation available", () => {
    const items = getSecondaryNavigation(createSession("user"));

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("notifications");
  });
});
