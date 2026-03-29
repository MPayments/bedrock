import { describe, expect, it, vi } from "vitest";

import { createCustomerPortalWorkflow } from "../src";

function createWorkflow(overrides?: {
  clients?: { data: Array<{ id: number; customerId: string | null; isDeleted: boolean }> };
  memberships?: Array<{ customerId: string; userId: string }>;
  customerId?: string;
}) {
  const memberships = overrides?.memberships ?? [
    { customerId: "customer-1", userId: "user-1" },
  ];
  const clientListResult = {
    data: overrides?.clients?.data ?? [
      { id: 101, customerId: "customer-1", isDeleted: false },
    ],
    total: overrides?.clients?.data?.length ?? 1,
    limit: 100,
    offset: 0,
  };
  const operations = {
    applications: {
      commands: {
        create: vi.fn(),
      },
      queries: {
        findById: vi.fn(),
        list: vi.fn(async () => ({
          data: [],
          total: 0,
          limit: 200,
          offset: 0,
        })),
      },
    },
    calculations: {
      queries: {
        list: vi.fn(async () => ({
          data: [],
          total: 0,
          limit: 50,
          offset: 0,
        })),
      },
    },
    clients: {
      commands: {
        create: vi.fn(async () => ({
          id: 202,
          customerId: overrides?.customerId ?? "customer-1",
        })),
      },
      queries: {
        findById: vi.fn(async (id: number) =>
          clientListResult.data.find((client) => client.id === id) ?? null,
        ),
        list: vi.fn(async () => clientListResult),
      },
    },
    deals: {
      queries: {
        findByIdWithDetails: vi.fn(),
        list: vi.fn(async () => ({
          data: [],
          total: 0,
          limit: 200,
          offset: 0,
        })),
      },
    },
  };
  const parties = {
    customerMemberships: {
      commands: {
        upsert: vi.fn(async (input) => input),
      },
      queries: {
        hasMembership: vi.fn(async (input) =>
          memberships.some(
            (membership) =>
              membership.customerId === input.customerId &&
              membership.userId === input.userId,
          ),
        ),
        listByUserId: vi.fn(async ({ userId }: { userId: string }) =>
          memberships.filter((membership) => membership.userId === userId),
        ),
      },
    },
    customers: {
      queries: {
        findById: vi.fn(async (customerId: string) => ({
          id: customerId,
          displayName: `Customer ${customerId}`,
          externalRef: null,
          description: null,
        })),
      },
    },
  };

  return {
    operations,
    parties,
    workflow: createCustomerPortalWorkflow({
      operations: operations as never,
      parties: parties as never,
      logger: { info: vi.fn() } as never,
    }),
  };
}

describe("customer portal workflow", () => {
  it("derives accessible clients from memberships instead of legacy user ids", async () => {
    const { operations, workflow } = createWorkflow({
      memberships: [
        { customerId: "customer-1", userId: "user-1" },
        { customerId: "customer-2", userId: "user-1" },
      ],
    });

    await workflow.getClients({ userId: "user-1" });

    expect(operations.clients.queries.list).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: ["customer-1", "customer-2"],
        isDeleted: false,
      }),
    );
  });

  it("reports membership-backed portal access in the profile", async () => {
    const { workflow } = createWorkflow({
      memberships: [{ customerId: "customer-1", userId: "user-1" }],
    });

    await expect(workflow.getProfile({ userId: "user-1" })).resolves.toEqual(
      expect.objectContaining({
        hasCustomerPortalAccess: true,
        memberships: [
          expect.objectContaining({
            customerId: "customer-1",
            userId: "user-1",
          }),
        ],
      }),
    );
  });

  it("upserts a membership after customer client creation", async () => {
    const { parties, workflow } = createWorkflow();

    await workflow.createClient(
      { userId: "user-1" },
      { orgName: "Acme Corp" } as never,
    );

    expect(parties.customerMemberships.commands.upsert).toHaveBeenCalledWith({
      customerId: "customer-1",
      userId: "user-1",
    });
  });

  it("rejects access when the client customer is not in the user's memberships", async () => {
    const { workflow } = createWorkflow({
      clients: {
        data: [{ id: 101, customerId: "customer-2", isDeleted: false }],
      },
      memberships: [{ customerId: "customer-1", userId: "user-1" }],
    });

    await expect(
      workflow.getClientById({ userId: "user-1" }, 101),
    ).rejects.toMatchObject({
      name: "CustomerNotAuthorizedError",
    });
  });
});
