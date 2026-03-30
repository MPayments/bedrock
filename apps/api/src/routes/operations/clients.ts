import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  ClientDocumentSchema,
  ClientSchema,
  CreateClientInputSchema,
  ListClientsQuerySchema,
  PaginatedClientsSchema,
  UpdateClientInputSchema,
  CompanyLookupResultSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import { handleRouteError } from "../../common/errors";
import type { AuthVariables } from "../../middleware/auth";
import { withRequiredIdempotency } from "../../middleware/idempotency";
import { requirePermission } from "../../middleware/permission";
import { OpsDeletedSchema, OpsErrorSchema, OpsIdParamSchema } from "./common";
import {
  CompatibilityContractSchema,
  CompatibilityCreateContractInputSchema,
  createCompatibilityContract,
  resolveEffectiveCompatibilityContractByClientId,
  updateCompatibilityContract,
} from "./contracts-compat";
import { exportClientsXlsx, xlsxFilename } from "./excel-export";

const PublicCreateClientInputSchema = CreateClientInputSchema;

const PublicUpdateClientInputSchema = UpdateClientInputSchema.omit({
  id: true,
});

export function operationsClientsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  // List clients
  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Clients"],
    summary: "List clients",
    request: { query: ListClientsQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedClientsSchema } },
        description: "Paginated list of clients",
      },
    },
  });

  // Get client by ID
  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Operations - Clients"],
    summary: "Get client by ID",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: ClientSchema } },
        description: "Client found",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Client not found",
      },
    },
  });

  // Create client
  const createRoute_ = createRoute({
    method: "post",
    path: "/",
    tags: ["Operations - Clients"],
    summary: "Create a new client",
    request: {
      body: {
        content: { "application/json": { schema: PublicCreateClientInputSchema } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: ClientSchema } },
        description: "Client created",
      },
    },
  });

  // Update client
  const updateRoute = createRoute({
    method: "patch",
    path: "/{id}",
    tags: ["Operations - Clients"],
    summary: "Update a client",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: { "application/json": { schema: PublicUpdateClientInputSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: ClientSchema } },
        description: "Client updated",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Client not found",
      },
    },
  });

  // Delete client
  const deleteRoute = createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["Operations - Clients"],
    summary: "Delete a client",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Client deleted",
      },
    },
  });

  // Get client contract
  const getContractRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}/contract",
    tags: ["Operations - Clients"],
    summary: "Get contract for client",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: CompatibilityContractSchema.nullable() },
        },
        description: "Client contract",
      },
    },
  });

  // Create/update client contract
  const createContractRoute = createRoute({
    middleware: [requirePermission({ agreements: ["create", "update"] })],
    method: "post",
    path: "/{id}/contract",
    tags: ["Operations - Clients"],
    summary: "Create or update contract for client",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CompatibilityCreateContractInputSchema.omit({ clientId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: CompatibilityContractSchema },
        },
        description: "Contract created/updated",
      },
    },
  });

  // Upload client document
  const uploadDocumentRoute = createRoute({
    method: "post",
    path: "/{id}/documents",
    tags: ["Operations - Clients"],
    summary: "Upload client document",
    request: { params: OpsIdParamSchema },
    responses: {
      201: {
        content: { "application/json": { schema: ClientDocumentSchema } },
        description: "Document uploaded",
      },
    },
  });

  // List client documents
  const listDocumentsRoute = createRoute({
    method: "get",
    path: "/{id}/documents",
    tags: ["Operations - Clients"],
    summary: "List documents for client",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.array(ClientDocumentSchema) },
        },
        description: "Client documents",
      },
    },
  });

  // Download client document
  const downloadDocumentRoute = createRoute({
    method: "get",
    path: "/{id}/documents/{docId}/download",
    tags: ["Operations - Clients"],
    summary: "Download client document",
    request: {
      params: OpsIdParamSchema.extend({
        docId: z.coerce.number().int(),
      }),
    },
    responses: {
      200: { description: "Redirect to signed URL" },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Document not found",
      },
    },
  });

  // Delete client document
  const deleteDocumentRoute = createRoute({
    method: "delete",
    path: "/{id}/documents/{docId}",
    tags: ["Operations - Clients"],
    summary: "Delete client document",
    request: {
      params: OpsIdParamSchema.extend({
        docId: z.coerce.number().int(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Document deleted",
      },
    },
  });

  // Lookup by INN
  const lookupRoute = createRoute({
    method: "get",
    path: "/lookup-by-inn",
    tags: ["Operations - Clients"],
    summary: "Lookup company by INN via DaData",
    request: {
      query: z.object({ inn: z.string().min(1) }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: CompanyLookupResultSchema.nullable() },
        },
        description: "Company lookup result",
      },
    },
  });

  // Search clients (uses list with q filter)
  const searchRoute = createRoute({
    method: "get",
    path: "/search",
    tags: ["Operations - Clients"],
    summary: "Search clients",
    request: {
      query: z.object({
        q: z.string().optional(),
        limit: z.coerce.number().int().default(20),
        offset: z.coerce.number().int().default(0),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedClientsSchema } },
        description: "Search results",
      },
    },
  });

  // Parse business card via AI
  const parseCardRoute = createRoute({
    method: "post",
    path: "/parse-card",
    tags: ["Operations - Clients"],
    summary: "Parse business card/document via AI",
    responses: {
      200: { content: { "application/json": { schema: z.any() } }, description: "Extracted data" },
    },
  });

  // Export to xlsx
  const exportXlsxRoute = createRoute({
    method: "get",
    path: "/export/xlsx",
    tags: ["Operations - Clients"],
    summary: "Export clients to XLSX",
    request: { query: ListClientsQuerySchema },
    responses: { 200: { description: "XLSX file" } },
  });

  return app
    .openapi(searchRoute, async (c) => {
      const { q, limit, offset } = c.req.valid("query");
      const result = await ctx.operationsModule.clients.queries.list({
        offset,
        limit,
        sortBy: "createdAt",
        sortOrder: "desc",
        ...(q ? { search: q } : {}),
      } as any);
      return c.json(result, 200);
    })
    .openapi(parseCardRoute, async (c) => {
      if (!ctx.documentExtraction) {
        return c.json({ error: "AI extraction not configured" }, 503 as any);
      }
      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === "string") {
        return c.json({ error: "File is required" }, 400 as any);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type;

      let result;
      if (mimeType === "application/pdf") {
        result = await ctx.documentExtraction.extractFromPdf(buffer);
      } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/msword") {
        result = await ctx.documentExtraction.extractFromDocx(buffer);
      } else if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel") {
        result = await ctx.documentExtraction.extractFromXlsx(buffer);
      } else {
        result = await ctx.documentExtraction.extractFromPdf(buffer);
      }
      return c.json(result, 200);
    })
    .openapi(exportXlsxRoute, async (c) => {
      const buffer = await exportClientsXlsx(ctx);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${xlsxFilename("clients")}"`,
        },
      });
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.clients.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(lookupRoute, async (c) => {
      const { inn } = c.req.valid("query");
      const searchCompany =
        ctx.operationsModule.clients.queries.searchCompany;
      if (!searchCompany) {
        return c.json(null, 200);
      }
      const result = await searchCompany(inn);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const client = await ctx.operationsModule.clients.queries.findById(id);
      if (!client) return c.json({ error: "Client not found" }, 404);
      return c.json(client, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const client = await ctx.operationsModule.clients.commands.create(input);
      return c.json(client, 201);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const client = await ctx.operationsModule.clients.commands.update({
        ...input,
        id,
      });
      return c.json(client as NonNullable<typeof client>, 200);
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      await ctx.operationsModule.clients.commands.softDelete(id);
      return c.json({ deleted: true }, 200);
    })
    .openapi(getContractRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const contract = await resolveEffectiveCompatibilityContractByClientId(
          ctx,
          id,
        );
        return c.json(contract, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createContractRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const input = c.req.valid("json");
        const existing = await resolveEffectiveCompatibilityContractByClientId(
          ctx,
          id,
        );

        if (existing) {
          const updated = await withRequiredIdempotency(c, (idempotencyKey) =>
            updateCompatibilityContract(
              ctx,
              input,
              existing.id,
              c.get("user")!.id,
              idempotencyKey,
            ),
          );

          if (updated instanceof Response) {
            return updated;
          }

          return c.json(updated, 201);
        }

        const created = await withRequiredIdempotency(c, (idempotencyKey) =>
          createCompatibilityContract(
            ctx,
            { ...input, clientId: id },
            c.get("user")!.id,
            idempotencyKey,
          ),
        );

        if (created instanceof Response) {
          return created;
        }

        return c.json(created, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadDocumentRoute, async (c) => {
      const { id } = c.req.valid("param");
      const docs = ctx.operationsModule.clients.documents;
      if (!docs) return c.json({ error: "Document storage not configured" } as any, 503 as any);

      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === "string") {
        return c.json({ error: "File is required" } as any, 400 as any);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const sessionUser = c.get("user")!;
      const result = await docs.commands.upload({
        clientId: id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        buffer,
        uploadedBy: sessionUser.id,
      });
      return c.json(result, 201);
    })
    .openapi(listDocumentsRoute, async (c) => {
      const { id } = c.req.valid("param");
      const docs = ctx.operationsModule.clients.documents;
      if (!docs) return c.json([], 200);
      const result = await docs.queries.listByClientId(id);
      return c.json(result, 200);
    })
    .openapi(downloadDocumentRoute, async (c) => {
      const { docId } = c.req.valid("param");
      const docs = ctx.operationsModule.clients.documents;
      if (!docs) return c.json({ error: "Documents not configured" }, 404);
      const url = await docs.getSignedUrl(docId);
      if (!url) return c.json({ error: "Document not found" }, 404);
      return c.redirect(url, 302);
    })
    .openapi(deleteDocumentRoute, async (c) => {
      const { docId } = c.req.valid("param");
      const docs = ctx.operationsModule.clients.documents;
      if (docs) await docs.commands.delete(docId);
      return c.json({ deleted: true }, 200);
    });
}
