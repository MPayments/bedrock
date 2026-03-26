import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CreateDealInputSchema,
  DealDocumentSchema,
  DealSchema,
  ListDealsQuerySchema,
  PaginatedDealsSchema,
  SetAgentBonusInputSchema,
  UpdateDealDetailsInputSchema,
  UpdateDealStatusInputSchema,
  DealsStatisticsQuerySchema,
  DealsStatisticsSchema,
  DealsByDayQuerySchema,
  DealsByDaySchema,
  DealsByStatusSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsErrorSchema, OpsIdParamSchema } from "./common";
import { exportDealsXlsx, xlsxFilename } from "./excel-export";

export function operationsDealsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Deals"],
    summary: "List deals",
    request: { query: ListDealsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedDealsSchema } },
        description: "Paginated list of deals",
      },
    },
  });

  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Operations - Deals"],
    summary: "Get deal with details",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Deal with details",
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
    tags: ["Operations - Deals"],
    summary: "Create deal",
    request: {
      body: {
        content: { "application/json": { schema: CreateDealInputSchema } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: DealSchema } },
        description: "Deal created",
      },
    },
  });

  const updateStatusRoute = createRoute({
    method: "patch",
    path: "/{id}/status",
    tags: ["Operations - Deals"],
    summary: "Update deal status",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealStatusInputSchema.omit({ id: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealSchema } },
        description: "Status updated",
      },
    },
  });

  const updateDetailsRoute = createRoute({
    method: "patch",
    path: "/{id}/details",
    tags: ["Operations - Deals"],
    summary: "Update deal details",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateDealDetailsInputSchema.omit({ id: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealSchema } },
        description: "Details updated",
      },
    },
  });

  const setBonusRoute = createRoute({
    method: "post",
    path: "/{id}/bonus",
    tags: ["Operations - Deals"],
    summary: "Set agent bonus for deal",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: SetAgentBonusInputSchema.omit({ dealId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Bonus set",
      },
    },
  });

  const statisticsRoute = createRoute({
    method: "get",
    path: "/statistics",
    tags: ["Operations - Deals"],
    summary: "Get deals statistics",
    request: { query: DealsStatisticsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: DealsStatisticsSchema } },
        description: "Statistics",
      },
    },
  });

  const byDayRoute = createRoute({
    method: "get",
    path: "/by-day",
    tags: ["Operations - Deals"],
    summary: "Get deals grouped by day",
    request: { query: DealsByDayQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: DealsByDaySchema } },
        description: "By-day breakdown",
      },
    },
  });

  // Deal documents
  const listDocumentsRoute = createRoute({
    method: "get",
    path: "/{id}/documents",
    tags: ["Operations - Deals"],
    summary: "List deal documents",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.array(DealDocumentSchema) },
        },
        description: "Deal documents",
      },
    },
  });

  const deleteDocumentRoute = createRoute({
    method: "delete",
    path: "/{id}/documents/{docId}",
    tags: ["Operations - Deals"],
    summary: "Delete deal document",
    request: {
      params: OpsIdParamSchema.extend({
        docId: z.coerce.number().int(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
        description: "Document deleted",
      },
    },
  });

  const byStatusRoute = createRoute({
    method: "get",
    path: "/by-status",
    tags: ["Operations - Deals"],
    summary: "Get deals grouped by status",
    responses: {
      200: {
        content: { "application/json": { schema: DealsByStatusSchema } },
        description: "By-status breakdown",
      },
    },
  });

  // --- Comment and dates as thin wrappers over updateDetails ---

  const updateCommentRoute = createRoute({
    method: "patch",
    path: "/{id}/comment",
    tags: ["Operations - Deals"],
    summary: "Update deal comment",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: { "application/json": { schema: z.object({ comment: z.string().nullable() }) } },
        required: true,
      },
    },
    responses: {
      200: { content: { "application/json": { schema: DealSchema } }, description: "Comment updated" },
    },
  });

  const updateDatesRoute = createRoute({
    method: "patch",
    path: "/{id}/dates",
    tags: ["Operations - Deals"],
    summary: "Update deal dates",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: z.object({
              contractDate: z.string().nullable().optional(),
              invoiceDate: z.string().nullable().optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: { content: { "application/json": { schema: DealSchema } }, description: "Dates updated" },
    },
  });

  const closeDealRoute = createRoute({
    method: "post",
    path: "/{id}/close",
    tags: ["Operations - Deals"],
    summary: "Close deal",
    request: { params: OpsIdParamSchema },
    responses: {
      200: { content: { "application/json": { schema: DealSchema } }, description: "Deal closed" },
    },
  });

  const exportExcelRoute = createRoute({
    method: "get",
    path: "/export-excel",
    tags: ["Operations - Deals"],
    summary: "Export deals to Excel",
    request: { query: ListDealsQuerySchema },
    responses: {
      200: { description: "Excel file" },
    },
  });

  const statsRoute = createRoute({
    method: "get",
    path: "/stats",
    tags: ["Operations - Deals"],
    summary: "Get deals dashboard stats",
    request: { query: DealsStatisticsQuerySchema },
    responses: {
      200: { content: { "application/json": { schema: DealsStatisticsSchema } }, description: "Stats" },
    },
  });

  const uploadDealDocumentRoute = createRoute({
    method: "post",
    path: "/{id}/documents",
    tags: ["Operations - Deals"],
    summary: "Upload deal document",
    request: { params: OpsIdParamSchema },
    responses: {
      201: { content: { "application/json": { schema: z.any() } }, description: "Document uploaded" },
    },
  });

  const downloadDealDocumentRoute = createRoute({
    method: "get",
    path: "/{id}/documents/{docId}/download",
    tags: ["Operations - Deals"],
    summary: "Download deal document",
    request: {
      params: OpsIdParamSchema.extend({ docId: z.coerce.number().int() }),
    },
    responses: {
      200: { content: { "application/json": { schema: z.object({ url: z.string() }) } }, description: "Signed URL" },
    },
  });

  return app
    .openapi(statisticsRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.deals.queries.getStatistics(query);
      return c.json(result, 200);
    })
    .openapi(byDayRoute, async (c) => {
      const query = c.req.valid("query");
      const data = await ctx.operationsModule.deals.queries.getByDay(query);
      return c.json({ data }, 200);
    })
    .openapi(byStatusRoute, async (c) => {
      const data = await ctx.operationsModule.deals.queries.getByStatus();
      return c.json({ data }, 200);
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.deals.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const deal =
        await ctx.operationsModule.deals.queries.findByIdWithDetails(id);
      if (!deal) return c.json({ error: "Deal not found" }, 404);
      return c.json(deal, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.deals.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(updateStatusRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.deals.commands.updateStatus({
          ...input,
          id,
        });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(updateDetailsRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.deals.commands.updateDetails({
          ...input,
          id,
        });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(setBonusRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.deals.commands.setAgentBonus({
          dealId: id,
          ...input,
        });
      return c.json(result, 200);
    })
    .openapi(listDocumentsRoute, async (c) => {
      const { id } = c.req.valid("param");
      const result =
        await ctx.operationsModule.deals.queries.listDocuments(id);
      return c.json(result, 200);
    })
    .openapi(deleteDocumentRoute, async (c) => {
      const { docId } = c.req.valid("param");
      const docs = ctx.operationsModule.deals.documents;
      if (docs) await docs.commands.delete(docId);
      return c.json({ deleted: true }, 200);
    })
    .openapi(updateCommentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const { comment } = c.req.valid("json");
      const result = await ctx.operationsModule.deals.commands.updateDetails({ id, comment });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(updateDatesRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.deals.commands.updateDetails({ id, ...input });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(closeDealRoute, async (c) => {
      const { id } = c.req.valid("param");
      const result = await ctx.operationsModule.deals.commands.updateStatus({ id, status: "done" });
      return c.json(result as NonNullable<typeof result>, 200);
    })
    .openapi(exportExcelRoute, async (c) => {
      const query = c.req.valid("query");
      const buffer = await exportDealsXlsx(ctx, query);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${xlsxFilename("deals-report")}"`,
        },
      });
    })
    .openapi(statsRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.deals.queries.getStatistics(query);
      return c.json(result, 200);
    })
    .openapi(uploadDealDocumentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const docs = ctx.operationsModule.deals.documents;
      if (!docs) return c.json({ error: "Document storage not configured" }, 503 as any);

      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === "string") {
        return c.json({ error: "File is required" }, 400 as any);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await docs.commands.upload({
        dealId: id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        buffer,
        uploadedBy: c.get("user")?.id ? Number(c.get("user")!.id) : 0,
      });
      return c.json(result, 201);
    })
    .openapi(downloadDealDocumentRoute, async (c) => {
      const { docId } = c.req.valid("param");
      const docs = ctx.operationsModule.deals.documents;
      if (!docs) return c.json({ url: "" }, 200);
      // Look up the document to get its s3Key
      const allDocs = await ctx.operationsModule.deals.queries.listDocuments(
        c.req.valid("param").id,
      );
      const doc = allDocs.find((d: any) => d.id === docId);
      if (!doc) return c.json({ url: "" }, 200);
      const url = await docs.getSignedUrl((doc as any).s3Key);
      return c.json({ url: url ?? "" }, 200);
    });
}
