import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CreateDealInputSchema,
  DealDetailsSchema,
  TransitionDealStatusInputSchema,
} from "@bedrock/deals/contracts";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../../common";
import { handleRouteError } from "../../common/errors";
import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { withRequiredIdempotency } from "../../middleware/idempotency";
import { requirePermission } from "../../middleware/permission";
import { exportDealsXlsx, xlsxFilename } from "./excel-export";
import {
  archiveCompatibilityCalculation,
  CompatibilityCalculationPreviewInputSchema,
  CompatibilityCalculationSchema,
  createCompatibilityCalculationForDeal,
  findCompatibilityCalculationById,
} from "./calculations-compat";
import {
  CompatibilityDealDocumentSchema,
  CompatibilityDealsByDayQuerySchema,
  CompatibilityDealsByDaySchema,
  CompatibilityDealsByStatusSchema,
  CompatibilityDealsListQuerySchema,
  CompatibilityDealsStatisticsQuerySchema,
  CompatibilityDealsStatisticsSchema,
  CompatibilityUpdateDealDetailsInputSchema,
  closeCompatibilityDeal,
  createCompatibilityDeal,
  findCompatibilityDealById,
  getCompatibilityDealDocumentDownloadUrl,
  getCompatibilityDealsByDay,
  getCompatibilityDealsStatistics,
  listCompatibilityDealCalculations,
  listCompatibilityDealDocuments,
  listCompatibilityDeals,
  listCompatibilityDealsGroupedByStatus,
  PaginatedCompatibilityDealListRowsSchema,
  transitionCompatibilityDealStatus,
  updateCompatibilityDealDetails,
  uploadCompatibilityDealDocument,
  deleteCompatibilityDealDocument,
} from "./deals-compat";

const DealDocumentTypeSchema = z.enum(["application", "invoice", "acceptance"]);

export function operationsDealsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Operations - Deals"],
    summary: "List canonical deal facade rows",
    request: { query: CompatibilityDealsListQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedCompatibilityDealListRowsSchema } },
        description: "Paginated compatibility deals",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Operations - Deals"],
    summary: "Get canonical deal facade detail",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Deal detail",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Deal not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ deals: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Operations - Deals"],
    summary: "Create canonical deal through operations facade",
    request: {
      body: {
        content: { "application/json": { schema: CreateDealInputSchema } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: DealDetailsSchema } },
        description: "Deal created",
      },
    },
  });

  const updateStatusRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/status",
    tags: ["Operations - Deals"],
    summary: "Transition canonical deal status",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: TransitionDealStatusInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DealDetailsSchema } },
        description: "Status updated",
      },
    },
  });

  const updateDetailsRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/details",
    tags: ["Operations - Deals"],
    summary: "Update deal compatibility extension details",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CompatibilityUpdateDealDetailsInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Details updated",
      },
    },
  });

  const listCalculationsRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/{id}/calculations",
    tags: ["Operations - Deals"],
    summary: "List deal calculations",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: z.array(CompatibilityCalculationSchema) } },
        description: "Deal calculations",
      },
    },
  });

  const createCalculationRoute = createRoute({
    middleware: [requirePermission({ calculations: ["create"] })],
    method: "post",
    path: "/{id}/calculations",
    tags: ["Operations - Deals"],
    summary: "Create and attach a calculation to a deal",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CompatibilityCalculationPreviewInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: CompatibilityCalculationSchema } },
        description: "Calculation created",
      },
    },
  });

  const deleteCalculationRoute = createRoute({
    middleware: [requirePermission({ calculations: ["delete"] })],
    method: "delete",
    path: "/{id}/calculations/{calcId}",
    tags: ["Operations - Deals"],
    summary: "Archive a deal calculation",
    request: {
      params: z.object({
        calcId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: DeletedSchema } },
        description: "Calculation archived",
      },
    },
  });

  const statisticsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/statistics",
    tags: ["Operations - Deals"],
    summary: "Get deal statistics",
    request: { query: CompatibilityDealsStatisticsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: CompatibilityDealsStatisticsSchema } },
        description: "Statistics",
      },
    },
  });

  const statsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/stats",
    tags: ["Operations - Deals"],
    summary: "Get deal dashboard stats",
    request: { query: CompatibilityDealsStatisticsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: CompatibilityDealsStatisticsSchema } },
        description: "Statistics",
      },
    },
  });

  const byDayRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/by-day",
    tags: ["Operations - Deals"],
    summary: "Get deals grouped by day",
    request: { query: CompatibilityDealsByDayQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: CompatibilityDealsByDaySchema } },
        description: "By-day data",
      },
    },
  });

  const byStatusRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/by-status",
    tags: ["Operations - Deals"],
    summary: "Get deals grouped by status buckets",
    responses: {
      200: {
        content: { "application/json": { schema: CompatibilityDealsByStatusSchema } },
        description: "Grouped deals",
      },
    },
  });

  const listDocumentsRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/documents",
    tags: ["Operations - Deals"],
    summary: "List deal documents",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: z.array(CompatibilityDealDocumentSchema) } },
        description: "Documents",
      },
    },
  });

  const uploadDocumentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/documents",
    tags: ["Operations - Deals"],
    summary: "Upload deal document",
    request: { params: IdParamSchema },
    responses: {
      201: {
        content: { "application/json": { schema: CompatibilityDealDocumentSchema } },
        description: "Document uploaded",
      },
    },
  });

  const deleteDocumentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "delete",
    path: "/{id}/documents/{docId}",
    tags: ["Operations - Deals"],
    summary: "Delete deal document",
    request: {
      params: IdParamSchema.extend({
        docId: z.coerce.number().int(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: DeletedSchema } },
        description: "Document deleted",
      },
    },
  });

  const downloadDocumentRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/documents/{docId}/download",
    tags: ["Operations - Deals"],
    summary: "Get deal document download url",
    request: {
      params: IdParamSchema.extend({
        docId: z.coerce.number().int(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ url: z.string() }) } },
        description: "Signed URL",
      },
    },
  });

  const updateCommentRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/comment",
    tags: ["Operations - Deals"],
    summary: "Update deal comment",
    request: {
      params: IdParamSchema,
      body: {
        content: { "application/json": { schema: z.object({ comment: z.string().nullable() }) } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Comment updated",
      },
    },
  });

  const updateDatesRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "patch",
    path: "/{id}/dates",
    tags: ["Operations - Deals"],
    summary: "Update compatibility document dates",
    request: {
      params: IdParamSchema,
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
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Dates updated",
      },
    },
  });

  const closeDealRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/close",
    tags: ["Operations - Deals"],
    summary: "Close deal",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: DealDetailsSchema } },
        description: "Deal closed",
      },
    },
  });

  const exportExcelRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/export-excel",
    tags: ["Operations - Deals"],
    summary: "Export deals to Excel",
    request: { query: CompatibilityDealsListQuerySchema },
    responses: {
      200: { description: "Excel file" },
    },
  });

  const uploadInvoiceRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/invoice/upload",
    tags: ["Operations - Deals"],
    summary: "Upload invoice file and extract fields",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), data: z.any() }),
          },
        },
        description: "Extracted invoice data",
      },
    },
  });

  const uploadContractRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{id}/contract/upload",
    tags: ["Operations - Deals"],
    summary: "Upload contract file and extract fields",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), data: z.any() }),
          },
        },
        description: "Extracted contract data",
      },
    },
  });

  const generateDocumentRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{id}/documents/{type}",
    tags: ["Operations - Deals"],
    summary: "Generate a deal document",
    request: {
      params: IdParamSchema.extend({ type: DealDocumentTypeSchema }),
      query: z.object({
        format: z.enum(["docx", "pdf"]).default("docx"),
        lang: z.enum(["ru", "en"]).default("ru"),
      }),
    },
    responses: {
      200: { description: "Document file" },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Deal not found",
      },
    },
  });

  const invoiceSchema = z.object({
    invoiceNumber: z.string(),
    invoiceDate: z.string(),
    companyName: z.string(),
    companyNameI18n: z
      .object({
        ru: z.string().nullable().optional(),
        en: z.string().nullable().optional(),
      })
      .optional(),
    bankName: z.string(),
    bankNameI18n: z
      .object({
        ru: z.string().nullable().optional(),
        en: z.string().nullable().optional(),
      })
      .optional(),
    account: z.string(),
    swiftCode: z.string(),
  });

  const contractSchema = z.object({
    contractNumber: z.string(),
    contractDate: z.string(),
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await listCompatibilityDeals(query);
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await findCompatibilityDealById(ctx, id);
        if (!result) {
          return c.json({ error: "Deal not found" }, 404);
        }

        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createRoute_, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          createCompatibilityDeal(ctx, body, c.get("user")!.id, idempotencyKey),
        );

        if (result instanceof Response) {
          return result;
        }

        return c.json(result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateStatusRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await transitionCompatibilityDealStatus(
          ctx,
          id,
          body,
          c.get("user")!.id,
        );

        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateDetailsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await updateCompatibilityDealDetails(
          ctx,
          id,
          body,
          c.get("user")!.id,
        );

        return c.json(result.deal, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listCalculationsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await listCompatibilityDealCalculations(id);
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createCalculationRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          createCompatibilityCalculationForDeal(
            ctx,
            id,
            body,
            c.get("user")!.id,
            idempotencyKey,
          ),
        );

        if (result instanceof Response) {
          return result;
        }

        return c.json(result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(deleteCalculationRoute, async (c) => {
      try {
        const { calcId, id } = c.req.valid("param");
        const calculation = await findCompatibilityCalculationById(calcId);
        if (!calculation || calculation.dealId !== id) {
          return c.json({ error: "Calculation not found" }, 404);
        }

        await archiveCompatibilityCalculation(ctx, calcId);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(statisticsRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await getCompatibilityDealsStatistics(query);
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(statsRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await getCompatibilityDealsStatistics(query);
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(byDayRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await getCompatibilityDealsByDay(query);
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(byStatusRoute, async (c) => {
      try {
        const result = await listCompatibilityDealsGroupedByStatus({});
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listDocumentsRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await listCompatibilityDealDocuments(id);
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadDocumentRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = await c.req.parseBody();
        const file = body.file;
        if (!file || typeof file === "string") {
          return c.json({ error: "File is required" }, 400);
        }

        const description =
          typeof body.description === "string" ? body.description : null;
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadCompatibilityDealDocument(ctx, {
          buffer,
          dealId: id,
          description,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          uploadedBy: c.get("user")!.id,
        });

        return c.json(result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(deleteDocumentRoute, async (c) => {
      try {
        const { docId } = c.req.valid("param");
        await deleteCompatibilityDealDocument(docId);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(downloadDocumentRoute, async (c) => {
      try {
        const { docId, id } = c.req.valid("param");
        const url = await getCompatibilityDealDocumentDownloadUrl(ctx, id, docId);
        return c.json({ url }, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateCommentRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const { comment } = c.req.valid("json");
        const result = await updateCompatibilityDealDetails(
          ctx,
          id,
          { comment },
          c.get("user")!.id,
        );
        return c.json(result.deal, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateDatesRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await updateCompatibilityDealDetails(
          ctx,
          id,
          body,
          c.get("user")!.id,
        );
        return c.json(result.deal, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(closeDealRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await closeCompatibilityDeal(ctx, id, c.get("user")!.id);
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(exportExcelRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const buffer = await exportDealsXlsx(ctx, query);
        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Disposition": `attachment; filename="${xlsxFilename("deals-report")}"`,
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadInvoiceRoute, async (c) => {
      try {
        if (!ctx.documentExtraction) {
          return c.json({ error: "AI extraction not configured" }, 400);
        }

        const { id } = c.req.valid("param");
        const deal = await findCompatibilityDealById(ctx, id);
        if (!deal) {
          return c.json({ error: "Deal not found" }, 404);
        }

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
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadContractRoute, async (c) => {
      try {
        if (!ctx.documentExtraction) {
          return c.json({ error: "AI extraction not configured" }, 400);
        }

        const { id } = c.req.valid("param");
        const deal = await findCompatibilityDealById(ctx, id);
        if (!deal) {
          return c.json({ error: "Deal not found" }, 404);
        }

        const body = await c.req.parseBody();
        const file = body.file;
        if (!file || typeof file === "string") {
          return c.json({ error: "File is required" }, 400);
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const extractedData = await ctx.documentExtraction.extractFromBuffer(
          buffer,
          file.type,
          contractSchema,
        );

        return c.json({ success: true, data: extractedData }, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(generateDocumentRoute, async (c) => {
      try {
        const { id, type } = c.req.valid("param");
        const { format, lang } = c.req.valid("query");
        const deal = await findCompatibilityDealById(ctx, id);
        if (!deal || !deal.client || !deal.contract || !deal.organization || !deal.organizationRequisite) {
          return c.json({ error: "Deal not found" }, 404);
        }

        const result = await ctx.documentGenerationWorkflow.generateDealDocument({
          calculation: (deal.calculation ?? {}) as Record<string, unknown>,
          client: deal.client as unknown as Record<string, unknown>,
          contract: deal.contract as unknown as Record<string, unknown>,
          deal: deal.deal as unknown as Record<string, unknown>,
          format,
          lang,
          organization: deal.organization as unknown as Record<string, unknown>,
          organizationRequisite: deal.organizationRequisite as Record<string, unknown>,
          templateType: type,
        });

        return new Response(new Uint8Array(result.buffer), {
          status: 200,
          headers: {
            "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"`,
            "Content-Type": result.mimeType,
          },
        });
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}
