import { describe, expect, it, vi } from "vitest";

import { createCustomerPortalWorkflow } from "../src";

function createWorkflow(overrides?: {
  counterpartiesByCustomerId?: Record<
    string,
    Array<{
      address?: string | null;
      country?: string | null;
      createdAt?: Date;
      customerId: string;
      directorName?: string | null;
      email?: string | null;
      externalId?: string | null;
      fullName?: string;
      id: string;
      inn?: string | null;
      phone?: string | null;
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
  const counterpartiesByCustomerId = overrides?.counterpartiesByCustomerId ?? {
    "customer-1": [
      {
        country: "RU",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        customerId: "customer-1",
        directorName: "Иван Иванов",
        email: "finance@example.com",
        externalId: "7700000000",
        fullName: "Customer counterparty",
        id: "counterparty-1",
        inn: "7700000000",
        phone: "+79990001122",
        relationshipKind: "customer_owned",
        shortName: "Customer counterparty",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
  };

  const calculations = {
    calculations: {
      queries: {
        findById: vi.fn(async () => null),
      },
    },
  };
  const currencies = {
    findByCode: vi.fn(async (code: string) => ({
      code,
      id: `${code.toLowerCase()}-id`,
      precision: 2,
    })),
    findById: vi.fn(async (currencyId: string) => ({
      code: currencyId === "usd-id" ? "USD" : "RUB",
      id: currencyId,
      precision: 2,
    })),
  };
  const deals = {
    deals: {
      commands: {
        create: vi.fn(),
      },
      queries: {
        findById: vi.fn(async () => null),
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
      commands: {
        create: vi.fn(async (input) => ({
          address: input.address ?? null,
          addressI18n: input.addressI18n ?? null,
          country: input.country ?? null,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          customerId: input.customerId,
          description: null,
          directorBasis: input.directorBasis ?? null,
          directorBasisI18n: input.directorBasisI18n ?? null,
          directorName: input.directorName ?? null,
          directorNameI18n: input.directorNameI18n ?? null,
          email: input.email ?? null,
          externalId: input.externalId ?? null,
          fullName: input.fullName,
          id: "counterparty-created",
          inn: input.inn ?? null,
          kind: "legal_entity",
          kpp: input.kpp ?? null,
          ogrn: input.ogrn ?? null,
          okpo: input.okpo ?? null,
          oktmo: input.oktmo ?? null,
          orgNameI18n: input.orgNameI18n ?? null,
          orgType: input.orgType ?? null,
          orgTypeI18n: input.orgTypeI18n ?? null,
          phone: input.phone ?? null,
          position: input.position ?? null,
          positionI18n: input.positionI18n ?? null,
          relationshipKind: "customer_owned",
          shortName: input.shortName,
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        })),
      },
      queries: {
        findById: vi.fn(async (counterpartyId: string) => {
          for (const items of Object.values(counterpartiesByCustomerId)) {
            const match = items.find((item) => item.id === counterpartyId);
            if (match) {
              return {
                address: match.address ?? null,
                addressI18n: null,
                country: match.country ?? null,
                createdAt:
                  match.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
                customerId: match.customerId,
                description: null,
                directorBasis: null,
                directorBasisI18n: null,
                directorName: match.directorName ?? null,
                directorNameI18n: null,
                email: match.email ?? null,
                externalId: match.externalId ?? null,
                fullName: match.fullName ?? match.shortName ?? counterpartyId,
                id: match.id,
                inn: match.inn ?? null,
                kind: "legal_entity",
                kpp: null,
                ogrn: null,
                okpo: null,
                oktmo: null,
                orgNameI18n: null,
                orgType: null,
                orgTypeI18n: null,
                phone: match.phone ?? null,
                position: null,
                positionI18n: null,
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
                  address: item.address ?? null,
                  addressI18n: null,
                  country: item.country ?? null,
                  createdAt:
                    item.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
                  customerId: item.customerId,
                  description: null,
                  directorBasis: null,
                  directorBasisI18n: null,
                  directorName: item.directorName ?? null,
                  directorNameI18n: null,
                  email: item.email ?? null,
                  externalId: item.externalId ?? null,
                  fullName: item.fullName ?? item.shortName ?? item.id,
                  id: item.id,
                  inn: item.inn ?? null,
                  kind: "legal_entity",
                  kpp: null,
                  ogrn: null,
                  okpo: null,
                  oktmo: null,
                  orgNameI18n: null,
                  orgType: null,
                  orgTypeI18n: null,
                  phone: item.phone ?? null,
                  position: null,
                  positionI18n: null,
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
      commands: {
        create: vi.fn(async (input) => ({
          id: "customer-created",
          displayName: input.displayName,
          externalRef: input.externalRef ?? null,
          description: input.description ?? null,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        })),
      },
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
    iam,
    parties,
    workflow: createCustomerPortalWorkflow({
      calculations: calculations as never,
      currencies: currencies as never,
      deals: deals as never,
      iam: iam as never,
      parties: parties as never,
      logger: { info: vi.fn() } as never,
    }),
  };
}

describe("customer portal workflow", () => {
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
      counterpartiesByCustomerId: {
        "customer-1": [
          {
            customerId: "customer-1",
            directorName: "Иван Иванов",
            email: "one@example.com",
            externalId: "7700000000",
            id: "counterparty-1",
            inn: "7700000000",
            phone: "+79990001122",
            shortName: "Acme RU",
          },
        ],
        "customer-2": [
          {
            customerId: "customer-2",
            externalId: "8800000000",
            id: "counterparty-2",
            inn: "8800000000",
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
              hasLegacyShell: false,
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

  it("creates a canonical customer and legal entity for portal onboarding", async () => {
    const { iam, parties, workflow } = createWorkflow({
      memberships: [],
      user: {
        role: "customer",
      },
    });

    const result = await workflow.createClient(
      { userId: "user-1" },
      {
        directorName: "Иван Иванов",
        email: "finance@example.com",
        inn: "7700000000",
        orgName: "Acme Corp",
        phone: "+79990001122",
      },
    );

    expect(parties.customers.commands.create).toHaveBeenCalledWith({
      description: null,
      displayName: "Acme Corp",
      externalRef: null,
    });
    expect(parties.counterparties.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-created",
        directorName: "Иван Иванов",
        email: "finance@example.com",
        inn: "7700000000",
        relationshipKind: "customer_owned",
        shortName: "Acme Corp",
      }),
    );
    expect(iam.customerMemberships.commands.upsert).toHaveBeenCalledWith({
      customerId: "customer-created",
      role: "owner",
      status: "active",
      userId: "user-1",
    });
    expect(result).toEqual(
      expect.objectContaining({
        counterpartyId: "counterparty-created",
        customerId: "customer-created",
        id: 0,
        orgName: "Acme Corp",
      }),
    );
  });

  it("rejects CRM-only users from portal legal-entity creation", async () => {
    const { workflow } = createWorkflow({
      memberships: [],
      user: {
        role: "user",
      },
    });

    await expect(
      workflow.createClient(
        { userId: "user-1" },
        {
          orgName: "CRM only",
        },
      ),
    ).rejects.toMatchObject({
      name: "CustomerNotAuthorizedError",
    });
  });
});
