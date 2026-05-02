import { describe, expect, it, vi } from "vitest";

import { createSeedOrchestrator } from "../../src/seeds/orchestrator";

function createHarness() {
  const calls: string[] = [];
  const fn = (name: string) =>
    vi.fn(async () => {
      calls.push(name);
    });

  const deps = {
    hashPassword: vi.fn(async () => "hashed"),
    seedAccounting: fn("required:accounting"),
    seedAgreements: fn("local:agreements"),
    seedBicDirectory: fn("required:bic-directory"),
    seedBootstrapAdminFromEnv: vi.fn(async () => {
      calls.push("required:bootstrap-admin");
    }),
    seedCounterparties: fn("local:counterparties"),
    seedCurrencies: fn("required:currencies"),
    seedDealPayment: fn("local:deal-payment"),
    seedRequiredManagedParties: fn("required:managed-parties"),
    seedOrganizations: fn("local:organizations"),
    seedPaymentRoutes: fn("local:payment-routes"),
    seedRequisiteProviders: fn("local:requisite-providers"),
    seedRequisites: fn("local:requisites"),
    seedUsers: vi.fn(async () => {
      calls.push("local:users");
    }),
  };

  return {
    calls,
    deps,
    orchestrator: createSeedOrchestrator(deps),
  };
}

describe("seed orchestrator", () => {
  it("runs only production-safe required seeds", async () => {
    const { calls, deps, orchestrator } = createHarness();

    await orchestrator.seedRequired({} as never, {
      env: {
        BEDROCK_BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        BEDROCK_BOOTSTRAP_ADMIN_PASSWORD: "secret",
        NODE_ENV: "production",
      },
    });

    expect(calls).toEqual([
      "required:accounting",
      "required:currencies",
      "required:bic-directory",
      "required:managed-parties",
      "required:bootstrap-admin",
    ]);
    expect(deps.seedUsers).not.toHaveBeenCalled();
    expect(deps.seedAgreements).not.toHaveBeenCalled();
    expect(deps.seedDealPayment).not.toHaveBeenCalled();
  });

  it("runs local fixtures behind the production guard", async () => {
    const { calls, orchestrator } = createHarness();

    await orchestrator.seedLocal({} as never, { env: { NODE_ENV: "test" } });

    expect(calls).toEqual([
      "local:users",
      "local:organizations",
      "local:counterparties",
      "local:requisite-providers",
      "local:requisites",
      "local:agreements",
      "local:payment-routes",
      "local:deal-payment",
    ]);
  });

  it("runs required before local in full local bootstrap", async () => {
    const { calls, orchestrator } = createHarness();

    await orchestrator.seedAll({} as never, { env: { NODE_ENV: "test" } });

    expect(calls).toEqual([
      "required:accounting",
      "required:currencies",
      "required:bic-directory",
      "required:managed-parties",
      "required:bootstrap-admin",
      "local:users",
      "local:organizations",
      "local:counterparties",
      "local:requisite-providers",
      "local:requisites",
      "local:agreements",
      "local:payment-routes",
      "local:deal-payment",
    ]);
  });

  it("blocks local and full seeds in production", async () => {
    const localHarness = createHarness();
    await expect(
      localHarness.orchestrator.seedLocal({} as never, {
        env: { NODE_ENV: "production" },
      }),
    ).rejects.toThrow(/Local seed fixtures are blocked/);
    expect(localHarness.calls).toEqual([]);

    const allHarness = createHarness();
    await expect(
      allHarness.orchestrator.seedAll({} as never, {
        env: { NODE_ENV: "production" },
      }),
    ).rejects.toThrow(/Local seed fixtures are blocked/);
    expect(allHarness.calls).toEqual([]);
  });
});
