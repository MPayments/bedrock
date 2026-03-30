import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  ApplicationSchema,
  CreateApplicationInputSchema,
  CreateDealInputSchema,
  DealSchema,
  ListApplicationsQuerySchema,
  PaginatedApplicationListRowsSchema,
  PaginatedApplicationsSchema,
  TakeApplicationInputSchema,
  UpdateApplicationCommentInputSchema,
  UpdateApplicationStatusInputSchema,
  ApplicationsStatisticsQuerySchema,
  ApplicationsStatisticsSchema,
  ApplicationsByDayQuerySchema,
  ApplicationsByDaySchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsErrorSchema, OpsIdParamSchema } from "./common";
import { exportApplicationsXlsx, xlsxFilename } from "./excel-export";
import { findCanonicalOrganizationByLegacyId } from "../organization-bridge";
import { getOrganizationBankRequisiteOrThrow } from "../organization-requisites";

export function operationsApplicationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Applications"],
    summary: "List applications",
    request: { query: ListApplicationsQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedApplicationListRowsSchema },
        },
        description: "Paginated list of applications",
      },
    },
  });

  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Operations - Applications"],
    summary: "Get application by ID",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Application found",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Not found",
      },
    },
  });

  const createRoute_ = createRoute({
    method: "post",
    path: "/",
    tags: ["Operations - Applications"],
    summary: "Create application",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateApplicationInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Application created",
      },
    },
  });

  const takeRoute = createRoute({
    method: "post",
    path: "/{id}/take",
    tags: ["Operations - Applications"],
    summary: "Take/assign application",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: z.object({ agentId: z.string().optional() }),
          },
        },
        required: false,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Application assigned",
      },
    },
  });

  const rejectRoute = createRoute({
    method: "patch",
    path: "/{id}/reject",
    tags: ["Operations - Applications"],
    summary: "Reject application",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Application rejected",
      },
    },
  });

  const commentRoute = createRoute({
    method: "patch",
    path: "/{id}/comment",
    tags: ["Operations - Applications"],
    summary: "Update application comment",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateApplicationCommentInputSchema.omit({ id: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationSchema } },
        description: "Comment updated",
      },
    },
  });

  const statisticsRoute = createRoute({
    method: "get",
    path: "/statistics",
    tags: ["Operations - Applications"],
    summary: "Get applications statistics",
    request: { query: ApplicationsStatisticsQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: ApplicationsStatisticsSchema },
        },
        description: "Statistics",
      },
    },
  });

  const byDayRoute = createRoute({
    method: "get",
    path: "/by-day",
    tags: ["Operations - Applications"],
    summary: "Get applications grouped by day",
    request: { query: ApplicationsByDayQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: ApplicationsByDaySchema } },
        description: "By-day breakdown",
      },
    },
  });

  // Create deal from application
  const createDealRoute = createRoute({
    method: "post",
    path: "/{id}/deal",
    tags: ["Operations - Applications"],
    summary: "Create deal from application",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateDealInputSchema.omit({
              applicationId: true,
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: DealSchema } },
        description: "Deal created",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Application not found",
      },
    },
  });

  const unassignedRoute = createRoute({
    method: "get",
    path: "/unassigned",
    tags: ["Operations - Applications"],
    summary: "List unassigned applications",
    request: {
      query: z.object({
        limit: z.coerce.number().int().default(20),
        offset: z.coerce.number().int().default(0),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedApplicationsSchema },
        },
        description: "Unassigned applications",
      },
    },
  });

  const recentRoute = createRoute({
    method: "get",
    path: "/recent",
    tags: ["Operations - Applications"],
    summary: "Get recent applications",
    request: {
      query: z.object({ period: z.string().default("month") }),
    },
    responses: {
      200: { content: { "application/json": { schema: z.any() } }, description: "Recent applications" },
    },
  });

  const exportExcelRoute = createRoute({
    method: "get",
    path: "/export-excel",
    tags: ["Operations - Applications"],
    summary: "Export applications to Excel",
    request: { query: ListApplicationsQuerySchema },
    responses: { 200: { description: "Excel file" } },
  });

  const deleteCalculationRoute = createRoute({
    method: "delete",
    path: "/{id}/calculations/{calcId}",
    tags: ["Operations - Applications"],
    summary: "Delete calculation from application",
    request: {
      params: OpsIdParamSchema.extend({ calcId: z.coerce.number().int() }),
    },
    responses: {
      200: { content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } }, description: "Deleted" },
    },
  });

  return app
    .openapi(recentRoute, async (c) => {
      // Return recent applications sorted by date
      const result = await ctx.operationsModule.applications.queries.list({
        limit: 20,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      return c.json(result.data, 200);
    })
    .openapi(exportExcelRoute, async (c) => {
      const query = c.req.valid("query");
      const buffer = await exportApplicationsXlsx(ctx, query);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${xlsxFilename("applications-report")}"`,
        },
      });
    })
    .openapi(statisticsRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.applications.queries.getStatistics(query);
      return c.json(result, 200);
    })
    .openapi(byDayRoute, async (c) => {
      const query = c.req.valid("query");
      const data =
        await ctx.operationsModule.applications.queries.getByDay(query);
      return c.json({ data }, 200);
    })
    .openapi(unassignedRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.applications.queries.listUnassigned(query);
      return c.json(result, 200);
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.applications.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const app_ =
        await ctx.operationsModule.applications.queries.findById(id);
      if (!app_) return c.json({ error: "Application not found" }, 404);
      return c.json(app_, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.applications.commands.create(input);
      const sessionUser = c.get("user");
      if (sessionUser) {
        ctx.operationsModule.activityLog.commands.log({
          userId: sessionUser.id, action: "create", entityType: "application",
          entityId: result.id, source: "web",
        }).catch(() => {});
      }
      return c.json(result, 201);
    })
    .openapi(takeRoute, async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const sessionUser = c.get("user")!;
      const result = await ctx.operationsModule.applications.commands.take({
        agentId: body.agentId ?? sessionUser.id,
        applicationId: id,
      });
      ctx.operationsModule.activityLog.commands.log({
        userId: sessionUser.id, action: "update", entityType: "application",
        entityId: id, source: "web", metadata: { subAction: "take" },
      }).catch(() => {});
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(rejectRoute, async (c) => {
      const { id } = c.req.valid("param");
      const result =
        await ctx.operationsModule.applications.commands.updateStatus({
          id,
          status: "rejected",
        });
      const sessionUser = c.get("user");
      if (sessionUser) {
        ctx.operationsModule.activityLog.commands.log({
          userId: sessionUser.id, action: "status_change", entityType: "application",
          entityId: id, source: "web", metadata: { status: "rejected" },
        }).catch(() => {});
      }
      return c.json(result!, 200);
    })
    .openapi(commentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.applications.commands.updateComment({
          ...input,
          id,
        });
      const sessionUser = c.get("user");
      if (sessionUser) {
        ctx.operationsModule.activityLog.commands.log({
          userId: sessionUser.id, action: "comment", entityType: "application",
          entityId: id, source: "web",
        }).catch(() => {});
      }
      return c.json(result!, 200);
    })
    .openapi(createDealRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const requisite = await getOrganizationBankRequisiteOrThrow(
        ctx,
        input.organizationRequisiteId,
      );
      const app = await ctx.operationsModule.applications.queries.findById(id);
      if (!app) {
        return c.json({ error: "Application not found" }, 404);
      }

      const contract = await ctx.operationsModule.contracts.queries.findByClient(
        app.clientId,
      );
      if (!contract) {
        return c.json({ error: "Contract not found" }, 404);
      }

      const organization =
        await findCanonicalOrganizationByLegacyId(ctx, contract.agentOrganizationId);
      if (!organization || requisite.ownerId !== organization.id) {
        return c.json(
          { error: "Organization requisite does not belong to contract organization" },
          400,
        );
      }

      const result = await ctx.operationsModule.deals.commands.create({
        ...input,
        applicationId: id,
      });
      return c.json(result, 201);
    })
    .openapi(deleteCalculationRoute, async (c) => {
      const { calcId } = c.req.valid("param");
      await ctx.operationsModule.calculations.commands.delete(calcId);
      return c.json({ deleted: true }, 200);
    });
}
