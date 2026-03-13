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
    expect(hrefs).toContain("/documents/commercial");
    expect(hrefs).toContain("/documents/journal");
    expect(hrefs).toContain("/entities");
    expect(hrefs).toContain("/fx");
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/settings/profile");
    expect(hrefs).toContain("/treasury");
    expect(hrefs).toContain("/users");
    expect(hrefs).toContain("/transfers");
    expect(hrefs).toContain("/treasury/counterparties");
    expect(hrefs).toContain("/entities/customers");
    expect(hrefs).toContain("/entities/organizations");
    expect(hrefs).toContain("/entities/counterparties");
    expect(hrefs).toContain("/entities/requisites");
    expect(hrefs).toContain("/entities/requisite-providers");
    expect(hrefs).toContain("/accounting/accounts");
    expect(hrefs).toContain("/accounting/correspondence");
    expect(hrefs).toContain("/accounting/reports");
    expect(hrefs).toContain("/fx/rates");
    expect(hrefs).not.toContain("/operations");
    expect(hrefs).not.toContain("#");
    expect(hrefs).not.toContain("/fx/quotes");
    expect(hrefs).not.toContain("/treasury/counterparty-accounts");
    expect(hrefs).not.toContain("/finance/accounting");
    expect(hrefs).not.toContain("/treasury/fx");
    expect(hrefs).not.toContain("/entities/parties/customers");
  });

  it("keeps secondary navigation available", () => {
    const items = getSecondaryNavigation(createSession("user"));

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("notifications");
  });
});
