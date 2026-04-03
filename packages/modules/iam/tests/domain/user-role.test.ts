import { describe, expect, it } from "vitest";

import { shouldProvisionAgentProfile } from "../../src/domain/user-role";

describe("shouldProvisionAgentProfile", () => {
  it("treats admin and agent roles as agent-profile candidates", () => {
    expect(shouldProvisionAgentProfile("admin")).toBe(true);
    expect(shouldProvisionAgentProfile("agent")).toBe(true);
  });

  it("excludes pre-portal and non-agent roles", () => {
    expect(shouldProvisionAgentProfile(null)).toBe(false);
    expect(shouldProvisionAgentProfile("user")).toBe(false);
    expect(shouldProvisionAgentProfile("customer")).toBe(false);
    expect(shouldProvisionAgentProfile("finance")).toBe(false);
  });
});
