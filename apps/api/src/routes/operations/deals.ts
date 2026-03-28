import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CreateDealInputSchema,
  DealDocumentSchema,
  DealSchema,
  ListDealsQuerySchema,
  PaginatedDealListRowsSchema,
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
        content: { "application/json": { schema: PaginatedDealListRowsSchema } },
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
        content: { "application/json": { schema: z.any() } },
        description: "Deals grouped by status category",
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

  const generateDealDocumentRoute = createRoute({
    method: "get",
    path: "/{id}/documents/{type}",
    tags: ["Operations - Deals"],
    summary: "Generate deal document (application, invoice, acceptance)",
    request: {
      params: OpsIdParamSchema.extend({
        type: z.enum(["application", "invoice", "acceptance"]),
      }),
      query: z.object({
        format: z.enum(["docx", "pdf"]).default("docx"),
        lang: z.enum(["ru", "en"]).default("ru"),
      }),
    },
    responses: {
      200: { description: "Document file" },
      404: { content: { "application/json": { schema: OpsErrorSchema } }, description: "Not found" },
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

  const invoiceUploadRoute = createRoute({
    method: "post",
    path: "/{id}/invoice/upload",
    tags: ["Operations - Deals"],
    summary: "Upload invoice file and extract data via AI",
    request: { params: OpsIdParamSchema },
    responses: {
      200: { content: { "application/json": { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: "Extracted invoice data" },
      400: { content: { "application/json": { schema: OpsErrorSchema } }, description: "Bad request" },
      404: { content: { "application/json": { schema: OpsErrorSchema } }, description: "Not found" },
    },
  });

  const LocalizedTextSchema = z.object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  }).optional();

  const invoiceSchema = z.object({
    invoiceNumber: z.string(),
    invoiceDate: z.string().describe("Date of the invoice in format dd.mm.yyyy. For example: 01.05.2025"),
    companyName: z.string(),
    companyNameI18n: LocalizedTextSchema,
    bankName: z.string(),
    bankNameI18n: LocalizedTextSchema,
    account: z.string(),
    swiftCode: z.string(),
  });

  return app
    .openapi(statisticsRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.deals.queries.getStatistics(query);
      const activeStatuses = ["preparing_documents", "awaiting_funds", "awaiting_payment", "closing_documents"];
      const activeCount = activeStatuses.reduce((sum, s) => sum + (result.byStatus[s] ?? 0), 0);
      return c.json({
        ...result,
        totalAmountInBase: Number(result.totalAmount) || 0,
        activeCount,
        doneCount: result.byStatus["done"] ?? 0,
      }, 200);
    })
    .openapi(byDayRoute, async (c) => {
      const query = c.req.valid("query");
      const data = await ctx.operationsModule.deals.queries.getByDay(query);
      return c.json({ data }, 200);
    })
    .openapi(byStatusRoute, async (c) => {
      const grouped = await ctx.operationsModule.deals.queries.listGroupedByStatus();
      return c.json(grouped, 200);
    })
    .openapi(statsRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.deals.queries.getStatistics(query);
      const activeStatuses = ["preparing_documents", "awaiting_funds", "awaiting_payment", "closing_documents"];
      const activeCount = activeStatuses.reduce((sum, s) => sum + (result.byStatus[s] ?? 0), 0);
      return c.json({
        ...result,
        totalAmountInBase: Number(result.totalAmount) || 0,
        activeCount,
        doneCount: result.byStatus["done"] ?? 0,
      }, 200);
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.deals.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(invoiceUploadRoute, async (c) => {
      const { id } = c.req.valid("param");

      if (!ctx.documentExtraction) {
        return c.json({ error: "AI extraction not configured" }, 400);
      }

      const deal = await ctx.operationsModule.deals.queries.findById(id);
      if (!deal) return c.json({ error: "Deal not found" }, 404);

      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === "string") {
        return c.json({ error: "File is required" }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const extractedData = await ctx.documentExtraction.extractFromBuffer(
        buffer,
        file.type,
        invoiceSchema,
      );

      return c.json({ success: true, data: extractedData }, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const deal =
        await ctx.operationsModule.deals.queries.findByIdWithDetails(id);
      if (!deal) return c.json({ error: "Deal not found" }, 404);

      // Enrich with contract, organization, organizationBank, subAgent
      let contract = null;
      let organization = null;
      let organizationBank = null;
      let subAgent = null;

      if (deal.application?.clientId) {
        contract = await ctx.operationsModule.contracts.queries.findByClient(deal.application.clientId);
      }

      if (deal.deal.agentOrganizationBankDetailsId) {
        organizationBank = await ctx.operationsModule.organizations.bankDetails.queries.findById(
          deal.deal.agentOrganizationBankDetailsId,
        );
        if (organizationBank) {
          organization = await ctx.operationsModule.organizations.queries.findById(
            (organizationBank as any).organizationId,
          );
        }
      }

      return c.json({
        ...deal,
        contract,
        organization,
        organizationBank,
        subAgent,
      }, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.deals.commands.create(input);
      const sessionUser = c.get("user");
      if (sessionUser) {
        ctx.operationsModule.activityLog.commands.log({
          userId: sessionUser.id, action: "create", entityType: "deal",
          entityId: result.id, source: "web",
        }).catch(() => {});
      }
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
      const sessionUser = c.get("user");
      if (sessionUser) {
        ctx.operationsModule.activityLog.commands.log({
          userId: sessionUser.id, action: "status_change", entityType: "deal",
          entityId: id, source: "web", metadata: { status: input.status },
        }).catch(() => {});
      }
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
      const sessionUser = c.get("user");
      if (sessionUser) {
        ctx.operationsModule.activityLog.commands.log({
          userId: sessionUser.id, action: "update", entityType: "deal",
          entityId: id, source: "web",
        }).catch(() => {});
      }
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
      const sessionUser = c.get("user");
      if (sessionUser) {
        ctx.operationsModule.activityLog.commands.log({
          userId: sessionUser.id, action: "status_change", entityType: "deal",
          entityId: id, source: "web", metadata: { status: "done" },
        }).catch(() => {});
      }
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
    .openapi(uploadDealDocumentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const docs = ctx.operationsModule.deals.documents;
      if (!docs) return c.json({ error: "Document storage not configured" }, 503 as any);

      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === "string") {
        return c.json({ error: "File is required" }, 400 as any);
      }
      const description = typeof body.description === "string" ? body.description : null;
      const buffer = Buffer.from(await file.arrayBuffer());
      const sessionUser = c.get("user")!;
      const result = await docs.commands.upload({
        dealId: id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        buffer,
        uploadedBy: sessionUser.id,
        description,
      });
      return c.json(result, 201);
    })
    .openapi(generateDealDocumentRoute, async (c) => {
      const { id, type } = c.req.valid("param");
      const { format, lang } = c.req.valid("query");

      const deal = await ctx.operationsModule.deals.queries.findByIdWithDetails(id);
      if (!deal) return c.json({ error: "Deal not found" }, 404);

      let contract = null;
      let organization = null;
      let organizationBank = null;

      if (deal.application?.clientId) {
        contract = await ctx.operationsModule.contracts.queries.findByClient(deal.application.clientId);
      }

      if (deal.deal.agentOrganizationBankDetailsId) {
        organizationBank = await ctx.operationsModule.organizations.bankDetails.queries.findById(
          deal.deal.agentOrganizationBankDetailsId,
        );
        if (organizationBank) {
          organization = await ctx.operationsModule.organizations.queries.findById(
            (organizationBank as any).organizationId,
          );
        }
      }

      // Fetch client details
      let client = null;
      if (deal.application?.clientId) {
        client = await ctx.operationsModule.clients.queries.findById(deal.application.clientId);
      }
      if (!client) return c.json({ error: "Client not found" }, 404);

      try {
        const result = await ctx.documentGenerationWorkflow.generateDealDocument({
          templateType: type,
          deal: deal.deal as unknown as Record<string, unknown>,
          calculation: (deal.calculation ?? {}) as Record<string, unknown>,
          client: client as unknown as Record<string, unknown>,
          contract: (contract ?? {}) as Record<string, unknown>,
          organization: (organization ?? {}) as Record<string, unknown>,
          organizationBank: (organizationBank ?? {}) as Record<string, unknown>,
          format,
          lang,
        });

        return new Response(new Uint8Array(result.buffer), {
          status: 200,
          headers: {
            "Content-Type": result.mimeType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"`,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.logger.error("Document generation failed", { error: message, stack: (err as Error).stack });
        return c.json({ error: message }, 500 as any);
      }
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
