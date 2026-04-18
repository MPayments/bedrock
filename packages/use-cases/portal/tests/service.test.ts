import { describe, expect, it, vi } from "vitest";

import { createPortalService } from "../src";

function createDeps() {
  const customers = {
    commands: {
      create: vi.fn(async () => ({
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        description: null,
        externalRef: null,
        id: "customer-1",
        name: "Acme",
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      })),
    },
    queries: {
      listByIds: vi.fn(async () => []),
    },
  };
  const counterparties = {
    commands: {
      create: vi.fn(async () => ({
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        customerId: "customer-1",
        fullName: "Acme",
        id: "counterparty-1",
        kind: "legal_entity",
        relationshipKind: "customer_owned",
        shortName: "Acme",
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      })),
    },
    queries: {
      findById: vi.fn(async () => null),
      list: vi.fn(async () => ({ data: [] })),
    },
  };
  const requisites = {
    commands: {
      upsertCounterpartyBankRequisite: vi.fn(async () => ({
        provider: { id: "provider-1" },
        requisite: { id: "requisite-1" },
      })),
    },
    queries: {
      searchBankProviders: vi.fn(async () => []),
      findById: vi.fn(async () => null),
      findProviderById: vi.fn(async () => null),
    },
  };
  const customerMemberships = {
    commands: {
      upsert: vi.fn(async () => undefined),
    },
    queries: {
      hasMembership: vi.fn(async () => true),
      listByUserId: vi.fn(async () => []),
    },
  };
  const portalAccessGrants = {
    commands: {
      consume: vi.fn(async () => undefined),
    },
    queries: {
      hasPendingGrant: vi.fn(async () => true),
    },
  };

  return {
    deps: {
      calculations: {
        calculations: { queries: { findById: vi.fn(async () => null) } },
      },
      currencies: {
        findByCode: vi.fn(async () => ({ id: "cur-usd" })),
        findById: vi.fn(async () => ({ code: "USD", id: "cur-usd", precision: 2 })),
      },
      deals: {
        deals: {
          commands: { createDraft: vi.fn() },
          queries: {
            findById: vi.fn(),
            findPortalById: vi.fn(),
            list: vi.fn(),
            listPortalDeals: vi.fn(),
          },
        },
      },
      iam: {
        customerMemberships: customerMemberships as any,
        portalAccessGrants: portalAccessGrants as any,
        users: {
          queries: {
            findById: vi.fn(async () => ({
              banned: false,
              id: "user-1",
              role: "agent",
            })),
          },
        },
      },
      logger: {
        info: vi.fn(),
      },
      parties: {
        counterparties: counterparties as any,
        customers: customers as any,
        requisites: requisites as any,
      },
    },
    refs: {
      counterparties,
      customerMemberships,
      customers,
      portalAccessGrants,
      requisites,
    },
  };
}

describe("portal service", () => {
  it("builds the profile flags from memberships and onboarding grants", async () => {
    const { deps } = createDeps();
    deps.iam.customerMemberships.queries.listByUserId = vi.fn(async () => [
      {
        customerId: "customer-1",
        role: "owner",
        status: "active",
        userId: "user-1",
      },
    ]);
    deps.parties.customers.queries.listByIds = vi.fn(async () => [
      {
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        description: null,
        externalRef: null,
        id: "customer-1",
        name: "Acme",
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);

    const service = createPortalService(deps as any);
    const profile = await service.getProfile({ userId: "user-1" });

    expect(profile.hasCustomerPortalAccess).toBe(true);
    expect(profile.hasOnboardingAccess).toBe(true);
    expect(profile.hasCrmAccess).toBe(true);
    expect(profile.customers).toHaveLength(1);
  });

  it("creates a customer-owned counterparty and grants ownership to the actor", async () => {
    const { deps, refs } = createDeps();
    const service = createPortalService(deps as any);

    const result = await service.createCounterparty(
      { userId: "user-1" },
      {
        bankMode: "manual",
        kind: "legal_entity",
        orgName: "Acme",
      },
    );

    expect(refs.customers.commands.create).toHaveBeenCalledWith({
      description: null,
      externalRef: null,
      name: "Acme",
    });
    expect(refs.counterparties.commands.create).toHaveBeenCalled();
    expect(refs.customerMemberships.commands.upsert).toHaveBeenCalledWith({
      customerId: "customer-1",
      role: "owner",
      status: "active",
      userId: "user-1",
    });
    expect(refs.portalAccessGrants.commands.consume).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect(refs.requisites.commands.upsertCounterpartyBankRequisite).toHaveBeenCalledWith({
      counterpartyId: "counterparty-1",
      values: {
        bankMode: "manual",
        kind: "legal_entity",
        orgName: "Acme",
      },
    });
    expect(result.customer.id).toBe("customer-1");
    expect(result.counterparty.id).toBe("counterparty-1");
  });
});
