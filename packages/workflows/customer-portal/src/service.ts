import type { CustomerMembershipsService } from "@bedrock/iam";
import type { OperationsModule } from "@bedrock/operations";
import type { DealWithDetails } from "@bedrock/operations/contracts";
import type { PartiesModule } from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";

export interface CustomerPortalWorkflowDeps {
  operations: Pick<
    OperationsModule,
    "applications" | "calculations" | "deals" | "clients"
  >;
  iam: {
    customerMemberships: CustomerMembershipsService;
  };
  parties: Pick<PartiesModule, "customers">;
  logger: Logger;
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
  hasCustomerPortalAccess: boolean;
  memberships: Awaited<
    ReturnType<CustomerMembershipsService["queries"]["listByUserId"]>
  >;
}

export function createCustomerPortalWorkflow(
  deps: CustomerPortalWorkflowDeps,
) {
  async function listMembershipsByUserId(userId: string) {
    return deps.iam.customerMemberships.queries.listByUserId({ userId });
  }

  async function listAuthorizedCustomerIds(userId: string) {
    const memberships = await listMembershipsByUserId(userId);
    return [...new Set(memberships.map((membership) => membership.customerId))];
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
    const customerIds = [...new Set(memberships.map((membership) => membership.customerId))];
    const customers = await Promise.all(
      customerIds.map((customerId) =>
        deps.parties.customers.queries.findById(customerId),
      ),
    );

    return {
      customers,
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
    ) {
      const result = await deps.operations.clients.commands.create(input);

      deps.logger.info("Customer created client", {
        userId: ctx.userId,
        clientId: result.id,
      });
      if (result.customerId) {
        await deps.iam.customerMemberships.commands.upsert({
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
