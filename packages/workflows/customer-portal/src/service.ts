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
  parties: Pick<PartiesModule, "customers">;
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
    return memberships.filter((membership) => membership.status === "active");
  }

  async function listAuthorizedCustomerIds(userId: string) {
    const memberships = await listActiveMembershipsByUserId(userId);
    return [...new Set(memberships.map((membership) => membership.customerId))];
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

    return bootstrapTransactional.withTransaction(async (tx) => {
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

  async function getClientsByUserId(userId: string) {
    const customerIds = await listAuthorizedCustomerIds(userId);
    if (customerIds.length === 0) {
      return {
        data: [],
        total: 0,
        limit: 100,
        offset: 0,
      };
    }

    return deps.operations.clients.queries.list({
      customerId: customerIds,
      isDeleted: false,
      limit: 100,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
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

  async function getProfile(ctx: CustomerContext): Promise<CustomerPortalProfile> {
    const memberships = await listMembershipsByUserId(ctx.userId);
    const activeMemberships = memberships.filter(
      (membership) => membership.status === "active",
    );
    const customerIds = [
      ...new Set(activeMemberships.map((membership) => membership.customerId)),
    ];
    const customers = await Promise.all(
      customerIds.map((customerId) =>
        deps.parties.customers.queries.findById(customerId),
      ),
    );
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
      return getClientsByUserId(ctx.userId);
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

      await assertClientOwnership(ctx.userId, application.clientId);
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
        clientId: number;
        requestedAmount?: string;
        requestedCurrency?: string;
      },
    ) {
      await assertClientOwnership(ctx.userId, input.clientId);

      const result = await deps.operations.applications.commands.create({
        clientId: input.clientId,
        source: "web",
        requestedAmount: input.requestedAmount,
        requestedCurrency: input.requestedCurrency,
        // No agentId — customer creates with status 'forming'
      });

      deps.logger.info("Customer created application", {
        userId: ctx.userId,
        clientId: input.clientId,
        applicationId: result.id,
      });

      return result;
    },

    async listMyApplications(
      ctx: CustomerContext,
      input?: { limit?: number; offset?: number },
    ) {
      const clientsResult = await getClientsByUserId(ctx.userId);
      const clientIds = clientsResult.data.map((c) => c.id);

      if (clientIds.length === 0) {
        return { data: [], total: 0, limit: input?.limit ?? 20, offset: input?.offset ?? 0 };
      }

      // Fetch applications for all customer's clients
      // Uses clientId filter — currently supports single clientId,
      // so we fetch per-client and merge
      const allApps = [];
      let totalCount = 0;
      for (const clientId of clientIds) {
        const result = await deps.operations.applications.queries.list({
          clientId,
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
        (a, b) =>
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
      await assertClientOwnership(ctx.userId, app.clientId);

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
      const clientsResult = await getClientsByUserId(ctx.userId);
      const clientIds = clientsResult.data.map((c) => c.id);

      if (clientIds.length === 0) {
        return { data: [], total: 0, limit: input?.limit ?? 20, offset: input?.offset ?? 0 };
      }

      const allDeals = [];
      let totalCount = 0;
      for (const clientId of clientIds) {
        const result = await deps.operations.deals.queries.list({
          clientId,
          limit: 200,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        allDeals.push(...result.data);
        totalCount += result.total;
      }

      allDeals.sort(
        (a, b) =>
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
      if (detail.client) {
        await assertClientOwnership(ctx.userId, detail.client.id);
      }
      return detail;
    },
  };
}

export type CustomerPortalWorkflow = ReturnType<
  typeof createCustomerPortalWorkflow
>;
