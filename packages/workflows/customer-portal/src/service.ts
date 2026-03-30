import { randomUUID } from "node:crypto";

import {
  type CustomerMembershipsService,
  type IamService,
  UserNotFoundError,
} from "@bedrock/iam";
import {
  DrizzleClientStore,
  DrizzleCustomerBridge,
} from "@bedrock/operations/adapters/drizzle";
import {
  DrizzleCustomerBootstrapClaimStore,
  DrizzleCustomerMembershipStore,
} from "@bedrock/iam/adapters/drizzle";
import type { OperationsModule } from "@bedrock/operations";
import {
  CreateClientInputSchema,
  type CreateClientInput,
  type DealWithDetails,
} from "@bedrock/operations/contracts";
import type { PartiesModule } from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

type LocalizedText = {
  en?: string | null;
  ru?: string | null;
};

export interface CustomerPortalWorkflowDeps {
  operations: Pick<
    OperationsModule,
    "applications" | "calculations" | "deals" | "clients"
  >;
  iam: {
    customerMemberships: CustomerMembershipsService;
    users: Pick<IamService, "queries">;
  };
  parties: Pick<PartiesModule, "counterparties" | "customers">;
  logger: Logger;
  persistence: PersistenceContext;
}

export interface CustomerContext {
  userId: string;
}

export class CustomerNotAuthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerNotAuthorizedError";
  }
}

export interface CustomerPortalProfile {
  customers: Awaited<
    ReturnType<PartiesModule["customers"]["queries"]["findById"]>
  >[];
  hasCrmAccess: boolean;
  hasCustomerPortalAccess: boolean;
  memberships: Awaited<
    ReturnType<CustomerMembershipsService["queries"]["listByUserId"]>
  >;
}

type CanonicalCustomer = Awaited<
  ReturnType<PartiesModule["customers"]["queries"]["findById"]>
>;
type LegacyClient = Awaited<
  ReturnType<OperationsModule["clients"]["queries"]["findById"]>
>;
type CanonicalCounterparty = Awaited<
  ReturnType<PartiesModule["counterparties"]["queries"]["findById"]>
>;
type CanonicalCounterpartyListItem = Awaited<
  ReturnType<PartiesModule["counterparties"]["queries"]["list"]>
>["data"][number];
type CustomerMembership = Awaited<
  ReturnType<CustomerMembershipsService["queries"]["listByUserId"]>
>[number];

export interface CustomerPortalLegalEntity {
  address: string | null;
  counterpartyId: string;
  country: string | null;
  createdAt: string;
  directorName: string | null;
  externalId: string | null;
  fullName: string;
  hasLegacyShell: boolean;
  inn: string | null;
  phone: string | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
  updatedAt: string;
  email: string | null;
}

export interface CustomerPortalCustomerContext {
  createdAt: string;
  customerId: string;
  description: string | null;
  displayName: string;
  externalRef: string | null;
  legalEntities: CustomerPortalLegalEntity[];
  legalEntityCount: number;
  primaryCounterpartyId: string | null;
  updatedAt: string;
}

type CustomerPortalBootstrapTx = {
  bootstrapClaimStore: DrizzleCustomerBootstrapClaimStore;
  clientStore: DrizzleClientStore;
  customerBridge: DrizzleCustomerBridge;
  customerMembershipStore: DrizzleCustomerMembershipStore;
};

function normalizeLocalizedField(
  value: string | null | undefined,
  i18n: LocalizedText | null | undefined,
): LocalizedText | null {
  if (!value && !i18n) {
    return null;
  }

  const result: LocalizedText = { ...i18n };
  if (value && !result.ru) {
    result.ru = value;
  }

  return result;
}

function normalizeBootstrapKeyPart(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeBootstrapCreateInput(input: CreateClientInput): CreateClientInput {
  return {
    ...input,
    orgNameI18n: normalizeLocalizedField(input.orgName, input.orgNameI18n),
    orgTypeI18n: normalizeLocalizedField(input.orgType ?? null, input.orgTypeI18n),
    directorNameI18n: normalizeLocalizedField(
      input.directorName ?? null,
      input.directorNameI18n,
    ),
    positionI18n: normalizeLocalizedField(input.position ?? null, input.positionI18n),
    directorBasisI18n: normalizeLocalizedField(
      input.directorBasis ?? null,
      input.directorBasisI18n,
    ),
    addressI18n: normalizeLocalizedField(input.address ?? null, input.addressI18n),
    bankNameI18n: normalizeLocalizedField(input.bankName ?? null, input.bankNameI18n),
    bankAddressI18n: normalizeLocalizedField(
      input.bankAddress ?? null,
      input.bankAddressI18n,
    ),
  };
}

function canAccessCrm(role: string | null, banned: boolean | null): boolean {
  if (banned) {
    return false;
  }

  return role === "admin" || role === "agent" || role === "user";
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function createClientShellFromCounterparty(input: {
  counterparty: CanonicalCounterparty;
  customerId: string;
}): CreateClientInput {
  return {
    account: null,
    address: null,
    addressI18n: null,
    bankAddress: null,
    bankAddressI18n: null,
    bankCountry: input.counterparty.country ?? null,
    bankName: null,
    bankNameI18n: null,
    bic: null,
    corrAccount: null,
    counterpartyId: input.counterparty.id,
    customerId: input.customerId,
    directorBasis: null,
    directorBasisI18n: null,
    directorName: null,
    directorNameI18n: null,
    email: null,
    inn: input.counterparty.externalId ?? null,
    kpp: null,
    ogrn: null,
    okpo: null,
    oktmo: null,
    orgName: input.counterparty.shortName,
    orgNameI18n: null,
    orgType: null,
    orgTypeI18n: null,
    phone: null,
    position: null,
    positionI18n: null,
    subAgentCounterpartyId: null,
  };
}

export function createCustomerPortalWorkflow(
  deps: CustomerPortalWorkflowDeps,
) {
  const bootstrapTransactional = createTransactionalPort(
    deps.persistence,
    (tx: Transaction): CustomerPortalBootstrapTx => ({
      bootstrapClaimStore: new DrizzleCustomerBootstrapClaimStore(tx),
      clientStore: new DrizzleClientStore(tx),
      customerBridge: new DrizzleCustomerBridge(tx),
      customerMembershipStore: new DrizzleCustomerMembershipStore(tx),
    }),
  );

  async function listMembershipsByUserId(userId: string) {
    return deps.iam.customerMemberships.queries.listByUserId({ userId });
  }

  async function listActiveMembershipsByUserId(userId: string) {
    const memberships = await listMembershipsByUserId(userId);
    return memberships.filter(
      (membership: CustomerMembership) => membership.status === "active",
    );
  }

  async function listAuthorizedCustomerIds(userId: string) {
    const memberships = await listActiveMembershipsByUserId(userId);
    return Array.from(
      new Set<string>(
        memberships.map((membership: CustomerMembership) => membership.customerId),
      ),
    );
  }

  async function getCrmAccess(userId: string) {
    try {
      const user = await deps.iam.users.queries.findById(userId);
      return canAccessCrm(user.role, user.banned);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return false;
      }

      throw error;
    }
  }

  async function ensureActiveOwnerMembership(input: {
    customerId: string;
    tx?: CustomerPortalBootstrapTx;
    userId: string;
  }) {
    if (input.tx) {
      return input.tx.customerMembershipStore.upsert({
        customerId: input.customerId,
        role: "owner",
        status: "active",
        userId: input.userId,
      });
    }

    return deps.iam.customerMemberships.commands.upsert({
      customerId: input.customerId,
      role: "owner",
      status: "active",
      userId: input.userId,
    });
  }

  async function listCustomerOwnedCounterpartiesByCustomerId(
    customerIds: string[],
  ) {
    const uniqueCustomerIds = Array.from(new Set(customerIds));
    const rows = await Promise.all(
      uniqueCustomerIds.map(async (customerId) => {
        const result = await deps.parties.counterparties.queries.list({
          customerId,
          relationshipKind: ["customer_owned"],
          limit: 200,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        return [customerId, result.data] as const;
      }),
    );

    return new Map<string, CanonicalCounterpartyListItem[]>(rows);
  }

  async function listActiveShellsByCounterpartyId(counterpartyIds: string[]) {
    const rows =
      await deps.operations.clients.queries.listActiveByCounterpartyIds(
        counterpartyIds,
      );

    return new Map(
      rows
        .filter((row) => Boolean(row.counterpartyId))
        .map((row) => [row.counterpartyId!, row] as const),
    );
  }

  function mapLegalEntity(input: {
    counterparty: CanonicalCounterpartyListItem;
    shell?: LegacyClient | null;
  }): CustomerPortalLegalEntity {
    const { counterparty, shell } = input;

    return {
      address: shell?.address ?? null,
      counterpartyId: counterparty.id,
      country: counterparty.country ?? null,
      createdAt: serializeDate(counterparty.createdAt),
      directorName: shell?.directorName ?? null,
      email: shell?.email ?? null,
      externalId: counterparty.externalId,
      fullName: counterparty.fullName,
      hasLegacyShell: Boolean(shell),
      inn: shell?.inn ?? counterparty.externalId ?? null,
      phone: shell?.phone ?? null,
      relationshipKind: counterparty.relationshipKind,
      shortName: counterparty.shortName,
      updatedAt: serializeDate(counterparty.updatedAt),
    };
  }

  async function ensureCustomerOwnedCounterpartyRecord(
    counterpartyId: string,
  ): Promise<CanonicalCounterparty> {
    const counterparty =
      await deps.parties.counterparties.queries.findById(counterpartyId);
    if (
      !counterparty ||
      !counterparty.customerId ||
      counterparty.relationshipKind !== "customer_owned"
    ) {
      throw new CustomerNotAuthorizedError(
        `Counterparty ${counterpartyId} is not a customer-owned legal entity`,
      );
    }

    return counterparty;
  }

  async function ensureActiveShellForCounterparty(counterpartyId: string) {
    const existingShell =
      await deps.operations.clients.queries.findActiveByCounterpartyId(
        counterpartyId,
      );
    if (existingShell) {
      return existingShell;
    }

    const counterparty =
      await ensureCustomerOwnedCounterpartyRecord(counterpartyId);
    const customer = await deps.parties.customers.queries.findById(
      counterparty.customerId!,
    );

    return deps.operations.clients.commands.create(
      createClientShellFromCounterparty({
        counterparty,
        customerId: customer.id,
      }),
    );
  }

  async function createBootstrapClient(input: {
    createInput: CreateClientInput;
    userId: string;
  }) {
    const normalizedInn = normalizeBootstrapKeyPart(input.createInput.inn);
    if (!normalizedInn) {
      throw new CustomerNotAuthorizedError(
        `User ${input.userId} cannot bootstrap a client without an INN`,
      );
    }

    const normalizedKpp = normalizeBootstrapKeyPart(input.createInput.kpp);
    const normalizedInput = normalizeBootstrapCreateInput(input.createInput);

    return bootstrapTransactional.withTransaction(
      async (tx: CustomerPortalBootstrapTx) => {
      const claim = await tx.bootstrapClaimStore.lockByKey({
        normalizedInn,
        normalizedKpp,
        userId: input.userId,
      });

      if (claim.status === "completed" && claim.clientId) {
        const existingClient = await tx.clientStore.findById(claim.clientId);
        if (!existingClient) {
          throw new Error(
            `Bootstrap claim ${claim.id} points to missing client ${claim.clientId}`,
          );
        }

        const linkedCustomerId = claim.customerId ?? existingClient.customerId;
        if (linkedCustomerId) {
          await ensureActiveOwnerMembership({
            customerId: linkedCustomerId,
            tx,
            userId: input.userId,
          });
        }

        return existingClient;
      }

      const createdClient = await tx.clientStore.create(normalizedInput);
      const customerId = await tx.customerBridge.ensureLinkedCustomer({
        customerId: createdClient.customerId,
        displayName: createdClient.orgName,
        legacyClientId: createdClient.id,
        nextCustomerId: randomUUID(),
      });
      const clientWithCustomer =
        createdClient.customerId === customerId
          ? createdClient
          : await tx.clientStore.update({
              id: createdClient.id,
              customerId,
            });

      await ensureActiveOwnerMembership({
        customerId,
        tx,
        userId: input.userId,
      });
      await tx.bootstrapClaimStore.complete({
        clientId: createdClient.id,
        customerId,
        id: claim.id,
      });

      return clientWithCustomer ?? createdClient;
    });
  }

  async function getCustomerContextsByUserId(
    userId: string,
  ): Promise<CustomerPortalCustomerContext[]> {
    const customerIds = await listAuthorizedCustomerIds(userId);
    if (customerIds.length === 0) {
      return [];
    }

    const customers = await deps.parties.customers.queries.listByIds(customerIds);
    const counterpartiesByCustomerId =
      await listCustomerOwnedCounterpartiesByCustomerId(customerIds);
    const shellMap = await listActiveShellsByCounterpartyId(
      [...counterpartiesByCustomerId.values()].flat().map(
        (counterparty) => counterparty.id,
      ),
    );

    return customers
      .map((customer) => {
        const legalEntities = (
          counterpartiesByCustomerId.get(customer.id) ?? []
        ).map((counterparty) =>
          mapLegalEntity({
            counterparty,
            shell: shellMap.get(counterparty.id) ?? null,
          }),
        );

        return {
          createdAt: serializeDate(customer.createdAt),
          customerId: customer.id,
          description: customer.description,
          displayName: customer.displayName,
          externalRef: customer.externalRef,
          legalEntities,
          legalEntityCount: legalEntities.length,
          primaryCounterpartyId: legalEntities[0]?.counterpartyId ?? null,
          updatedAt: serializeDate(customer.updatedAt),
        } satisfies CustomerPortalCustomerContext;
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
  }

  async function assertClientOwnership(
    userId: string,
    clientId: number,
  ): Promise<void> {
    const client = await deps.operations.clients.queries.findById(clientId);
    if (!client || !client.customerId || client.isDeleted) {
      throw new CustomerNotAuthorizedError(
        `Client ${clientId} not found or not owned by user ${userId}`,
      );
    }

    const hasMembership =
      await deps.iam.customerMemberships.queries.hasMembership({
        customerId: client.customerId,
        userId,
      });
    if (!hasMembership) {
      throw new CustomerNotAuthorizedError(
        `Client ${clientId} not found or not owned by user ${userId}`,
      );
    }
  }

  async function assertCounterpartyOwnership(
    userId: string,
    counterpartyId: string,
  ): Promise<CanonicalCounterparty> {
    const counterparty =
      await ensureCustomerOwnedCounterpartyRecord(counterpartyId);

    const hasMembership =
      await deps.iam.customerMemberships.queries.hasMembership({
        customerId: counterparty.customerId!,
        userId,
      });
    if (!hasMembership) {
      throw new CustomerNotAuthorizedError(
        `Counterparty ${counterpartyId} not found or not owned by user ${userId}`,
      );
    }

    return counterparty;
  }

  async function getProfile(ctx: CustomerContext): Promise<CustomerPortalProfile> {
    const memberships = await listMembershipsByUserId(ctx.userId);
    const activeMemberships = memberships.filter(
      (membership: CustomerMembership) => membership.status === "active",
    );
    const customerIds = Array.from(
      new Set<string>(
        activeMemberships.map(
          (membership: CustomerMembership) => membership.customerId,
        ),
      ),
    );
    const customers = await deps.parties.customers.queries.listByIds(customerIds);
    const hasCrmAccess = await getCrmAccess(ctx.userId);

    return {
      customers,
      hasCrmAccess,
      hasCustomerPortalAccess: customerIds.length > 0,
      memberships,
    };
  }

  async function assertPortalAccess(ctx: CustomerContext): Promise<void> {
    const profile = await getProfile(ctx);
    if (!profile.hasCustomerPortalAccess) {
      throw new CustomerNotAuthorizedError(
        `User ${ctx.userId} does not have customer portal access`,
      );
    }
  }

  return {
    assertPortalAccess,

    async createClient(
      ctx: CustomerContext,
      input: Parameters<typeof deps.operations.clients.commands.create>[0],
      options?: { idempotencyKey?: string | null },
    ) {
      const profile = await getProfile(ctx);
      const validated = CreateClientInputSchema.parse(input);
      let result;

      if (profile.hasCustomerPortalAccess) {
        result = await deps.operations.clients.commands.create(validated);
      } else if (profile.hasCrmAccess) {
        throw new CustomerNotAuthorizedError(
          `User ${ctx.userId} must use CRM to create clients`,
        );
      } else {
        if (!options?.idempotencyKey) {
          throw new CustomerNotAuthorizedError(
            `User ${ctx.userId} cannot bootstrap a client without an Idempotency-Key`,
          );
        }

        result = await createBootstrapClient({
          createInput: validated,
          userId: ctx.userId,
        });
      }

      deps.logger.info("Customer created client", {
        userId: ctx.userId,
        clientId: result.id,
      });
      if (result.customerId) {
        await ensureActiveOwnerMembership({
          customerId: result.customerId,
          userId: ctx.userId,
        });
      }

      return result;
    },

    getProfile,

    async getClients(ctx: CustomerContext) {
      const data = await getCustomerContextsByUserId(ctx.userId);
      return {
        data,
        total: data.length,
      };
    },

    async getCustomerContexts(ctx: CustomerContext) {
      const data = await getCustomerContextsByUserId(ctx.userId);
      return {
        data,
        total: data.length,
      };
    },

    async getClientById(ctx: CustomerContext, clientId: number) {
      await assertClientOwnership(ctx.userId, clientId);
      return deps.operations.clients.queries.findById(clientId);
    },

    async getApplicationById(ctx: CustomerContext, applicationId: number) {
      const application =
        await deps.operations.applications.queries.findById(applicationId);
      if (!application) {
        throw new CustomerNotAuthorizedError(
          `Application ${applicationId} not found`,
        );
      }

      if (application.counterpartyId) {
        await assertCounterpartyOwnership(ctx.userId, application.counterpartyId);
      } else {
        await assertClientOwnership(ctx.userId, application.clientId);
      }
      const calculations = await deps.operations.calculations.queries.list({
        applicationId,
        limit: 50,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      return {
        application,
        calculations: calculations.data,
      };
    },

    async createApplication(
      ctx: CustomerContext,
      input: {
        counterpartyId: string;
        requestedAmount?: string;
        requestedCurrency?: string;
      },
    ) {
      await assertCounterpartyOwnership(ctx.userId, input.counterpartyId);
      await ensureActiveShellForCounterparty(input.counterpartyId);

      const result = await deps.operations.applications.commands.create({
        counterpartyId: input.counterpartyId,
        source: "web",
        requestedAmount: input.requestedAmount,
        requestedCurrency: input.requestedCurrency,
        // No agentId — customer creates with status 'forming'
      });

      deps.logger.info("Customer created application", {
        userId: ctx.userId,
        counterpartyId: input.counterpartyId,
        applicationId: result.id,
      });

      return result;
    },

    async listMyApplications(
      ctx: CustomerContext,
      input?: { limit?: number; offset?: number },
    ) {
      const customerIds = await listAuthorizedCustomerIds(ctx.userId);
      const counterpartiesByCustomerId =
        await listCustomerOwnedCounterpartiesByCustomerId(customerIds);
      const counterpartyIds = [...counterpartiesByCustomerId.values()]
        .flat()
        .map((counterparty) => counterparty.id);

      if (counterpartyIds.length === 0) {
        return { data: [], total: 0, limit: input?.limit ?? 20, offset: input?.offset ?? 0 };
      }

      const allApps: Awaited<
        ReturnType<OperationsModule["applications"]["queries"]["list"]>
      >["data"] = [];
      let totalCount = 0;
      for (const counterpartyId of counterpartyIds) {
        const result = await deps.operations.applications.queries.list({
          counterpartyId,
          limit: 200,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        allApps.push(...result.data);
        totalCount += result.total;
      }

      // Sort by createdAt desc and paginate in memory
      allApps.sort(
        (
          a: (typeof allApps)[number],
          b: (typeof allApps)[number],
        ) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      return {
        data: allApps.slice(offset, offset + limit),
        total: totalCount,
        limit,
        offset,
      };
    },

    async listMyCalculations(
      ctx: CustomerContext,
      applicationId: number,
    ) {
      // Verify ownership through application's client
      const app =
        await deps.operations.applications.queries.findById(applicationId);
      if (!app) {
        throw new CustomerNotAuthorizedError(
          `Application ${applicationId} not found`,
        );
      }
      if (app.counterpartyId) {
        await assertCounterpartyOwnership(ctx.userId, app.counterpartyId);
      } else {
        await assertClientOwnership(ctx.userId, app.clientId);
      }

      return deps.operations.calculations.queries.list({
        applicationId,
        limit: 50,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
    },

    async listMyDeals(
      ctx: CustomerContext,
      input?: { limit?: number; offset?: number },
    ) {
      const customerIds = await listAuthorizedCustomerIds(ctx.userId);
      const counterpartiesByCustomerId =
        await listCustomerOwnedCounterpartiesByCustomerId(customerIds);
      const counterpartyIds = [...counterpartiesByCustomerId.values()]
        .flat()
        .map((counterparty) => counterparty.id);

      if (counterpartyIds.length === 0) {
        return { data: [], total: 0, limit: input?.limit ?? 20, offset: input?.offset ?? 0 };
      }

      const allDeals: Awaited<
        ReturnType<OperationsModule["deals"]["queries"]["list"]>
      >["data"] = [];
      let totalCount = 0;
      for (const counterpartyId of counterpartyIds) {
        const result = await deps.operations.deals.queries.list({
          counterpartyId,
          limit: 200,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        allDeals.push(...result.data);
        totalCount += result.total;
      }

      allDeals.sort(
        (
          a: (typeof allDeals)[number],
          b: (typeof allDeals)[number],
        ) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      return {
        data: allDeals.slice(offset, offset + limit),
        total: totalCount,
        limit,
        offset,
      };
    },

    async getDealById(ctx: CustomerContext, dealId: number): Promise<DealWithDetails> {
      const detail =
        await deps.operations.deals.queries.findByIdWithDetails(dealId);
      if (!detail) {
        throw new CustomerNotAuthorizedError(`Deal ${dealId} not found`);
      }
      if (detail.application.counterpartyId) {
        await assertCounterpartyOwnership(
          ctx.userId,
          detail.application.counterpartyId,
        );
      } else if (detail.client) {
        await assertClientOwnership(ctx.userId, detail.client.id);
      }
      return detail;
    },
  };
}

export type CustomerPortalWorkflow = ReturnType<
  typeof createCustomerPortalWorkflow
>;
