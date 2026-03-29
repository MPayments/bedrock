import { describe, expect, it, vi } from "vitest";

import { createCustomerPortalWorkflow } from "../src";

function createWorkflow(overrides?: {
  clients?: {
    data: Array<{
      counterpartyId: string | null;
      customerId: string | null;
      id: number;
      isDeleted: boolean;
    }>;
  };
  counterpartiesByCustomerId?: Record<
    string,
    Array<{
      country?: string | null;
      createdAt?: Date;
      customerId: string;
      externalId?: string | null;
      fullName?: string;
      id: string;
      relationshipKind?: "customer_owned" | "external";
      shortName?: string;
      updatedAt?: Date;
    }>
  >;
  memberships?: Array<{
    customerId: string;
    id?: string;
    role?: string;
    status?: string;
    userId: string;
  }>;
  customerId?: string;
  user?: {
    banned?: boolean | null;
    role?: string | null;
  };
}) {
  const memberships = overrides?.memberships ?? [
    {
      customerId: "customer-1",
      id: "membership-1",
      role: "owner",
      status: "active",
      userId: "user-1",
    },
  ];
  const clientListResult = {
    data: overrides?.clients?.data ?? [
      {
        counterpartyId: "counterparty-1",
        customerId: "customer-1",
        id: 101,
        isDeleted: false,
      },
    ],
    total: overrides?.clients?.data?.length ?? 1,
    limit: 100,
    offset: 0,
  };
  const counterpartiesByCustomerId = overrides?.counterpartiesByCustomerId ?? {
    "customer-1": [
      {
        country: "RU",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        customerId: "customer-1",
        externalId: "7700000000",
        fullName: "Customer counterparty",
        id: "counterparty-1",
        relationshipKind: "customer_owned",
        shortName: "Customer counterparty",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
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
          counterpartyId: "counterparty-202",
          id: 202,
          customerId: overrides?.customerId ?? "customer-1",
        })),
      },
      queries: {
        findActiveByCounterpartyId: vi.fn(async (counterpartyId: string) =>
          clientListResult.data.find(
            (client) => client.counterpartyId === counterpartyId,
          ) ?? null,
        ),
        findById: vi.fn(async (id: number) =>
          clientListResult.data.find((client) => client.id === id) ?? null,
        ),
        list: vi.fn(async () => clientListResult),
        listActiveByCounterpartyIds: vi.fn(async (counterpartyIds: string[]) =>
          clientListResult.data.filter(
            (client) =>
              client.counterpartyId !== null &&
              counterpartyIds.includes(client.counterpartyId),
          ),
        ),
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
  const iam = {
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
    users: {
      queries: {
        findById: vi.fn(async () => ({
          id: "user-1",
          banned: overrides?.user?.banned ?? false,
          role: overrides?.user?.role ?? "customer",
        })),
      },
    },
  };
  const parties = {
    counterparties: {
      queries: {
        findById: vi.fn(async (counterpartyId: string) => {
          for (const items of Object.values(counterpartiesByCustomerId)) {
            const match = items.find((item) => item.id === counterpartyId);
            if (match) {
              return {
                country: match.country ?? null,
                createdAt:
                  match.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
                customerId: match.customerId,
                description: null,
                externalId: match.externalId ?? null,
                fullName: match.fullName ?? match.shortName ?? counterpartyId,
                id: match.id,
                kind: "legal_entity",
                relationshipKind: match.relationshipKind ?? "customer_owned",
                shortName: match.shortName ?? match.fullName ?? counterpartyId,
                updatedAt:
                  match.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
              };
            }
          }

          return null;
        }),
        list: vi.fn(async ({ customerId }: { customerId?: string }) => ({
          data:
            customerId && counterpartiesByCustomerId[customerId]
              ? counterpartiesByCustomerId[customerId].map((item) => ({
                  country: item.country ?? null,
                  createdAt:
                    item.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
                  customerId: item.customerId,
                  description: null,
                  externalId: item.externalId ?? null,
                  fullName: item.fullName ?? item.shortName ?? item.id,
                  id: item.id,
                  kind: "legal_entity",
                  relationshipKind: item.relationshipKind ?? "customer_owned",
                  shortName: item.shortName ?? item.fullName ?? item.id,
                  updatedAt:
                    item.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
                }))
              : [],
          limit: 200,
          offset: 0,
          total: customerId ? (counterpartiesByCustomerId[customerId]?.length ?? 0) : 0,
        })),
      },
    },
    customers: {
      queries: {
        findById: vi.fn(async (customerId: string) => ({
          id: customerId,
          displayName: `Customer ${customerId}`,
          externalRef: null,
          description: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        })),
        listByIds: vi.fn(async (customerIds: string[]) =>
          customerIds.map((customerId) => ({
            id: customerId,
            displayName: `Customer ${customerId}`,
            externalRef: null,
            description: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          })),
        ),
      },
    },
  };

  return {
    operations,
    iam,
    parties,
    workflow: createCustomerPortalWorkflow({
      operations: operations as never,
      iam: iam as never,
      parties: parties as never,
      logger: { info: vi.fn() } as never,
      persistence: {
        db: {} as never,
        runInTransaction: vi.fn(async () => {
          throw new Error("Unexpected transaction in test");
        }),
      },
    }),
  };
}

describe("customer portal workflow", () => {
  it("derives accessible customer contexts from memberships", async () => {
    const { operations, workflow } = createWorkflow({
      clients: {
        data: [
          {
            counterpartyId: "counterparty-1",
            customerId: "customer-1",
            id: 101,
            isDeleted: false,
          },
          {
            counterpartyId: "counterparty-2",
            customerId: "customer-2",
            id: 102,
            isDeleted: false,
          },
        ],
      },
      counterpartiesByCustomerId: {
        "customer-1": [
          {
            customerId: "customer-1",
            id: "counterparty-1",
            shortName: "Entity 1",
          },
        ],
        "customer-2": [
          {
            customerId: "customer-2",
            id: "counterparty-2",
            shortName: "Entity 2",
          },
        ],
      },
      memberships: [
        {
          customerId: "customer-1",
          id: "membership-1",
          role: "owner",
          status: "active",
          userId: "user-1",
        },
        {
          customerId: "customer-2",
          id: "membership-2",
          role: "owner",
          status: "active",
          userId: "user-1",
        },
      ],
    });

    await workflow.getClients({ userId: "user-1" });

    expect(
      operations.clients.queries.listActiveByCounterpartyIds,
    ).toHaveBeenCalledWith(["counterparty-1", "counterparty-2"]);
  });

  it("reports membership-backed portal access in the profile", async () => {
    const { workflow } = createWorkflow({
      memberships: [
        {
          customerId: "customer-1",
          id: "membership-1",
          role: "owner",
          status: "active",
          userId: "user-1",
        },
      ],
      user: {
        role: "user",
      },
    });

    await expect(workflow.getProfile({ userId: "user-1" })).resolves.toEqual(
      expect.objectContaining({
        hasCrmAccess: true,
        hasCustomerPortalAccess: true,
        memberships: [
          expect.objectContaining({
            customerId: "customer-1",
            status: "active",
            userId: "user-1",
          }),
        ],
      }),
    );
  });

  it("upserts a membership after customer client creation", async () => {
    const { iam, workflow } = createWorkflow();

    await workflow.createClient(
      { userId: "user-1" },
      { orgName: "Acme Corp" } as never,
    );

    expect(iam.customerMemberships.commands.upsert).toHaveBeenCalledWith({
      customerId: "customer-1",
      role: "owner",
      status: "active",
      userId: "user-1",
    });
  });

  it("returns canonical customer contexts with legal entities", async () => {
    const { workflow } = createWorkflow({
      memberships: [
        {
          customerId: "customer-1",
          id: "membership-1",
          role: "owner",
          status: "active",
          userId: "user-1",
        },
        {
          customerId: "customer-2",
          id: "membership-2",
          role: "owner",
          status: "active",
          userId: "user-1",
        },
      ],
      clients: {
        data: [
          {
            counterpartyId: "counterparty-1",
            customerId: "customer-1",
            id: 101,
            isDeleted: false,
          },
        ],
      },
      counterpartiesByCustomerId: {
        "customer-1": [
          {
            customerId: "customer-1",
            externalId: "7700000000",
            id: "counterparty-1",
            shortName: "Acme RU",
          },
        ],
        "customer-2": [
          {
            customerId: "customer-2",
            externalId: "8800000000",
            id: "counterparty-2",
            shortName: "Acme EU",
          },
        ],
      },
    });

    await expect(
      workflow.getCustomerContexts({ userId: "user-1" }),
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          customerId: "customer-1",
          displayName: "Customer customer-1",
          legalEntities: [
            expect.objectContaining({
              counterpartyId: "counterparty-1",
              hasLegacyShell: true,
              shortName: "Acme RU",
            }),
          ],
          legalEntityCount: 1,
          primaryCounterpartyId: "counterparty-1",
        }),
        expect.objectContaining({
          customerId: "customer-2",
          displayName: "Customer customer-2",
          legalEntities: [
            expect.objectContaining({
              counterpartyId: "counterparty-2",
              hasLegacyShell: false,
              shortName: "Acme EU",
            }),
          ],
          legalEntityCount: 1,
          primaryCounterpartyId: "counterparty-2",
        }),
      ],
      total: 2,
    });
  });

  it("rejects access when the client customer is not in the user's memberships", async () => {
    const { workflow } = createWorkflow({
      clients: {
        data: [
          {
            counterpartyId: "counterparty-2",
            customerId: "customer-2",
            id: 101,
            isDeleted: false,
          },
        ],
      },
      memberships: [
        {
          customerId: "customer-1",
          id: "membership-1",
          role: "owner",
          status: "active",
          userId: "user-1",
        },
      ],
    });

    await expect(
      workflow.getClientById({ userId: "user-1" }, 101),
    ).rejects.toMatchObject({
      name: "CustomerNotAuthorizedError",
    });
  });
});
