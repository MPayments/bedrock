import { describe, expect, it } from "vitest";

import { shouldProvisionAgentProfile } from "../../src/domain/user-role";

describe("shouldProvisionAgentProfile", () => {
  it("treats admin, agent, and legacy null roles as agent-profile candidates", () => {
    expect(shouldProvisionAgentProfile("admin")).toBe(true);
    expect(shouldProvisionAgentProfile("agent")).toBe(true);
    expect(shouldProvisionAgentProfile(null)).toBe(true);
  });

  it("excludes non-agent roles", () => {
    expect(shouldProvisionAgentProfile("user")).toBe(false);
    expect(shouldProvisionAgentProfile("customer")).toBe(false);
    expect(shouldProvisionAgentProfile("finance")).toBe(false);
  });
});
