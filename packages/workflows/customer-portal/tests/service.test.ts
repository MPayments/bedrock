import { describe, expect, it, vi } from "vitest";

import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";

import { createCustomerPortalWorkflow } from "../src";

function createWorkflow(overrides?: {
  counterpartiesByCustomerId?: Record<
    string,
    {
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
    }[]
  >;
  memberships?: {
    customerId: string;
    id?: string;
    role?: string;
    status?: string;
    userId: string;
  }[];
  hasPendingPortalGrant?: boolean;
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
        createDraft: vi.fn(async (input) => ({
          summary: {
            id: "deal-1",
          },
          ...input,
        })),
      },
      queries: {
        findById: vi.fn(async () => null),
        findPortalById: vi.fn(async () => ({
          attachments: [],
          calculationSummary: null,
          customerSafeIntake: {
            contractNumber: null,
            customerNote: null,
            expectedAmount: null,
            expectedCurrencyId: null,
            invoiceNumber: null,
            purpose: null,
            requestedExecutionDate: null,
            sourceAmount: "1000",
            sourceCurrencyId: "usd-id",
            targetCurrencyId: "eur-id",
          },
          nextAction: "Submit deal",
          quoteSummary: null,
          requiredActions: [],
          submissionCompleteness: {
            blockingReasons: [],
            complete: true,
          },
          summary: {
            applicantDisplayName: "Customer counterparty",
            createdAt: "2026-02-01T00:00:00.000Z",
            id: "deal-1",
            status: "draft",
            type: "currency_exchange",
          },
          timeline: [],
        })),
        list: vi.fn(async () => ({
          data: [],
          total: 0,
          limit: MAX_QUERY_LIST_LIMIT,
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
    portalAccessGrants: {
      commands: {
        consume: vi.fn(async () => null),
        create: vi.fn(async () => null),
        revoke: vi.fn(async () => null),
      },
      queries: {
        findByUserId: vi.fn(async ({ userId }: { userId: string }) =>
          overrides?.hasPendingPortalGrant
            ? {
                id: "grant-1",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                status: "pending_onboarding",
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                userId,
              }
            : null,
        ),
        hasPendingGrant: vi.fn(
          async () => overrides?.hasPendingPortalGrant ?? false,
        ),
      },
    },
    users: {
      queries: {
        findById: vi.fn(async () => ({
          id: "user-1",
          banned: overrides?.user?.banned ?? false,
          role: overrides?.user?.role ?? "agent",
        })),
      },
    },
  };
  const parties = {
    counterparties: {
      commands: {
        create: vi.fn(async (input) => ({
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          customerId: input.customerId,
          description: null,
          country: input.legalEntity?.profile.countryCode ?? null,
          externalId: input.externalId ?? null,
          fullName:
            input.legalEntity?.profile.fullName ??
            input.fullName ??
            input.shortName ??
            "Counterparty",
          id: "counterparty-created",
          kind: "legal_entity",
          legalEntity: input.legalEntity ?? null,
          relationshipKind: "customer_owned",
          shortName:
            input.legalEntity?.profile.shortName ??
            input.shortName ??
            input.fullName ??
            "Counterparty",
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
          limit: MAX_QUERY_LIST_LIMIT,
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
    requisites: {
      commands: {
        create: vi.fn(async (input) => ({
          id: "requisite-created",
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          organizationId:
            input.ownerType === "organization" ? input.ownerId : null,
          counterpartyId:
            input.ownerType === "counterparty" ? input.ownerId : null,
          providerId: input.providerId,
          providerBranchId: input.providerBranchId ?? null,
          currencyId: input.currencyId,
          kind: input.kind,
          label: input.label,
          beneficiaryName: input.beneficiaryName ?? null,
          beneficiaryNameLocal: input.beneficiaryNameLocal ?? null,
          beneficiaryAddress: input.beneficiaryAddress ?? null,
          paymentPurposeTemplate: input.paymentPurposeTemplate ?? null,
          notes: input.notes ?? null,
          identifiers: input.identifiers ?? [],
          isDefault: input.isDefault ?? false,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
          archivedAt: null,
        })),
        createProvider: vi.fn(async (input) => ({
          id: "provider-created",
          kind: input.kind,
          legalName: input.legalName,
          displayName: input.displayName,
          description: input.description ?? null,
          country: input.country ?? null,
          jurisdictionCode: input.jurisdictionCode ?? null,
          website: input.website ?? null,
          identifiers: input.identifiers ?? [],
          branches: input.branches ?? [],
          archivedAt: null,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        })),
        update: vi.fn(async (id: string, input) => ({
          id,
          ownerType: "counterparty",
          ownerId: "counterparty-created",
          organizationId: null,
          counterpartyId: "counterparty-created",
          providerId: input.providerId ?? "provider-created",
          providerBranchId: input.providerBranchId ?? null,
          currencyId: input.currencyId ?? "usd-id",
          kind: input.kind ?? "bank",
          label: input.label ?? "Bank details",
          beneficiaryName: input.beneficiaryName ?? null,
          beneficiaryNameLocal: input.beneficiaryNameLocal ?? null,
          beneficiaryAddress: input.beneficiaryAddress ?? null,
          paymentPurposeTemplate: input.paymentPurposeTemplate ?? null,
          notes: input.notes ?? null,
          identifiers: input.identifiers ?? [],
          isDefault: input.isDefault ?? false,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
          archivedAt: null,
        })),
      },
      queries: {
        findProviderById: vi.fn(async () => null),
        list: vi.fn(async () => ({
          data: [],
          limit: 50,
          offset: 0,
          total: 0,
        })),
        listProviders: vi.fn(async () => ({
          data: [],
          limit: 50,
          offset: 0,
          total: 0,
        })),
      },
    },
  };

  return {
    currencies,
    deals,
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
        role: "agent",
      },
    });

    await expect(workflow.getProfile({ userId: "user-1" })).resolves.toEqual(
      expect.objectContaining({
        hasOnboardingAccess: true,
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
      hasPendingPortalGrant: true,
      user: {
        role: null,
      },
    });

    const result = await workflow.createLegalEntity(
      { userId: "user-1" },
      {
        bankMode: "manual",
        bankProvider: {
          country: "RU",
          name: "АО Банк",
          routingCode: "044525225",
        },
        bankRequisite: {
          accountNo: "40702810900000000001",
          beneficiaryName: "Acme Corp",
        },
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
        externalId: "7700000000",
        kind: "legal_entity",
        legalEntity: expect.objectContaining({
          contacts: expect.arrayContaining([
            expect.objectContaining({
              type: "email",
              value: "finance@example.com",
            }),
          ]),
          identifiers: expect.arrayContaining([
            expect.objectContaining({
              scheme: "inn",
              value: "7700000000",
            }),
          ]),
          profile: expect.objectContaining({
            shortName: "Acme Corp",
          }),
          representatives: expect.arrayContaining([
            expect.objectContaining({
              fullName: "Иван Иванов",
              role: "director",
            }),
          ]),
        }),
        relationshipKind: "customer_owned",
      }),
    );
    expect(iam.customerMemberships.commands.upsert).toHaveBeenCalledWith({
      customerId: "customer-created",
      role: "owner",
      status: "active",
      userId: "user-1",
    });
    expect(parties.requisites.commands.createProvider).toHaveBeenCalled();
    expect(parties.requisites.commands.create).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        account: "40702810900000000001",
        bankCountry: "RU",
        bankName: "АО Банк",
        bic: "044525225",
        counterpartyId: "counterparty-created",
        customerId: "customer-created",
        id: 0,
        orgName: "Acme Corp",
      }),
    );
  });

  it("allows onboarding legal-entity creation for mixed-access internal users", async () => {
    const { workflow } = createWorkflow({
      memberships: [],
      hasPendingPortalGrant: true,
      user: {
        role: "agent",
      },
    });

    await expect(
      workflow.createLegalEntity(
        { userId: "user-1" },
        {
          bankMode: "existing",
          orgName: "CRM only",
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        customerId: "customer-created",
        orgName: "CRM only",
      }),
    );
  });

  it("allows bank-provider search during initial onboarding", async () => {
    const { parties, workflow } = createWorkflow({
      memberships: [],
      hasPendingPortalGrant: true,
      user: {
        role: null,
      },
    });
    const listProvidersMock = parties.requisites.queries.listProviders as ReturnType<
      typeof vi.fn
    >;
    const findProviderByIdMock = parties.requisites.queries.findProviderById as ReturnType<
      typeof vi.fn
    >;
    listProvidersMock.mockResolvedValueOnce({
      data: [
        {
          archivedAt: null,
          country: "RU",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          description: null,
          displayName: "АО Банк",
          id: "provider-1",
          kind: "bank",
          legalName: "АО Банк",
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
          website: null,
          jurisdictionCode: null,
        },
      ],
      limit: 8,
      offset: 0,
      total: 1,
    });
    findProviderByIdMock.mockResolvedValueOnce({
      archivedAt: null,
      branches: [
        {
          archivedAt: null,
          city: null,
          code: null,
          contactEmail: null,
          contactPhone: null,
          country: "RU",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          id: "branch-1",
          identifiers: [],
          isPrimary: true,
          jurisdictionCode: null,
          line1: null,
          line2: null,
          name: "АО Банк",
          postalCode: null,
          providerId: "provider-1",
          rawAddress: "Москва",
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
      country: "RU",
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      description: null,
      displayName: "АО Банк",
      id: "provider-1",
      identifiers: [
        {
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          id: "provider-bic-1",
          isPrimary: true,
          normalizedValue: "044525225",
          scheme: "bic",
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
          value: "044525225",
        },
        {
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          id: "provider-swift-1",
          isPrimary: true,
          normalizedValue: "BANKRUMM",
          scheme: "swift",
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
          value: "BANKRUMM",
        },
      ],
      jurisdictionCode: null,
      kind: "bank",
      legalName: "АО Банк",
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
      website: null,
    });

    await expect(
      workflow.searchBankProviders(
        { userId: "user-1" },
        { query: "Банк", limit: 8 },
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        bic: "044525225",
        country: "RU",
        id: "provider-1",
        name: "АО Банк",
        swift: "BANKRUMM",
      }),
    ]);
  });

  it("allows bank-provider search for mixed-access internal users during onboarding", async () => {
    const { parties, workflow } = createWorkflow({
      memberships: [],
      hasPendingPortalGrant: true,
      user: {
        role: "agent",
      },
    });
    const listProvidersMock = parties.requisites.queries.listProviders as ReturnType<
      typeof vi.fn
    >;
    listProvidersMock.mockResolvedValueOnce({
      data: [],
      limit: 8,
      offset: 0,
      total: 0,
    });

    await expect(
      workflow.searchBankProviders(
        { userId: "user-1" },
        { query: "Банк", limit: 8 },
      ),
    ).resolves.toEqual([]);
  });

  it("accepts ISO currency codes for typed portal deal drafts and resolves them to ids", async () => {
    const { currencies, deals, workflow } = createWorkflow();

    const result = await workflow.createDealDraft(
      { userId: "user-1" },
      {
        common: {
          applicantCounterpartyId: "counterparty-1",
          customerNote: null,
          requestedExecutionDate: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: null,
          expectedAt: null,
          expectedCurrencyId: null,
          invoiceNumber: null,
        },
        moneyRequest: {
          purpose: "FX exchange",
          sourceAmount: "1000",
          sourceCurrencyId: "USD",
          targetCurrencyId: "EUR",
        },
        type: "currency_exchange",
      },
      { idempotencyKey: "portal-draft-1" },
    );

    expect(currencies.findByCode).toHaveBeenCalledWith("USD");
    expect(currencies.findByCode).toHaveBeenCalledWith("EUR");
    expect(deals.deals.commands.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-1",
        intake: expect.objectContaining({
          moneyRequest: expect.objectContaining({
            sourceCurrencyId: "usd-id",
            targetCurrencyId: "eur-id",
          }),
        }),
      }),
    );
    expect(result.summary.id).toBe("deal-1");
  });
});
