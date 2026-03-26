import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  ClientDocumentSchema,
  ClientSchema,
  ContractSchema,
  CreateClientInputSchema,
  CreateContractInputSchema,
  ListClientsQuerySchema,
  PaginatedClientsSchema,
  UpdateClientInputSchema,
  CompanyLookupResultSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsDeletedSchema, OpsErrorSchema, OpsIdParamSchema } from "./common";

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
        content: { "application/json": { schema: CreateClientInputSchema } },
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
        content: { "application/json": { schema: UpdateClientInputSchema.omit({ id: true }) } },
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
    method: "get",
    path: "/{id}/contract",
    tags: ["Operations - Clients"],
    summary: "Get contract for client",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: ContractSchema.nullable() } },
        description: "Client contract",
      },
    },
  });

  // Create/update client contract
  const createContractRoute = createRoute({
    method: "post",
    path: "/{id}/contract",
    tags: ["Operations - Clients"],
    summary: "Create or update contract for client",
    request: {
      params: OpsIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateContractInputSchema.omit({ clientId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: ContractSchema } },
        description: "Contract created/updated",
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

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.clients.queries.list(query);
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
    .openapi(getContractRoute, async (c) => {
      const { id } = c.req.valid("param");
      const contract =
        await ctx.operationsModule.contracts.queries.findByClient(id);
      return c.json(contract, 200);
    })
    .openapi(createContractRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const existing =
        await ctx.operationsModule.contracts.queries.findByClient(id);
      if (existing) {
        const updated = await ctx.operationsModule.contracts.commands.update({
          ...input,
          id: existing.id,
        });
        return c.json(updated!, 201);
      }
      const created = await ctx.operationsModule.contracts.commands.create({
        ...input,
        clientId: id,
      });
      return c.json(created, 201);
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
