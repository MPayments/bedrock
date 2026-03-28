import type { OperationsModule } from "@bedrock/operations";
import type { DealWithDetails } from "@bedrock/operations/contracts";
import type { Logger } from "@bedrock/platform/observability/logger";

export interface CustomerPortalWorkflowDeps {
  operations: Pick<
    OperationsModule,
    "applications" | "calculations" | "deals" | "clients"
  >;
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

export function createCustomerPortalWorkflow(
  deps: CustomerPortalWorkflowDeps,
) {
  async function getClientsByUserId(userId: string) {
    return deps.operations.clients.queries.list({
      userId,
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
    if (!client || client.userId !== userId || client.isDeleted) {
      throw new CustomerNotAuthorizedError(
        `Client ${clientId} not found or not owned by user ${userId}`,
      );
    }
  }

  return {
    async createClient(
      ctx: CustomerContext,
      input: Parameters<typeof deps.operations.clients.commands.create>[0],
    ) {
      const result = await deps.operations.clients.commands.create(input);

      deps.logger.info("Customer created client", {
        userId: ctx.userId,
        clientId: result.id,
      });

      return result;
    },

    async getClients(ctx: CustomerContext) {
      return getClientsByUserId(ctx.userId);
    },

    async getClientById(ctx: CustomerContext, clientId: number) {
      await assertClientOwnership(ctx.userId, clientId);
      return deps.operations.clients.queries.findById(clientId);
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
