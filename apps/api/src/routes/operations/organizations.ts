import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  BankDetailsSchema,
  CreateBankDetailsInputSchema,
  CreateOrganizationInputSchema,
  ListBankDetailsQuerySchema,
  ListOrganizationsQuerySchema,
  OrganizationSchema,
  PaginatedBankDetailsSchema,
  PaginatedOrganizationsSchema,
  UpdateBankDetailsInputSchema,
  UpdateOrganizationInputSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsDeletedSchema, OpsErrorSchema, OpsIdParamSchema } from "./common";

const OpsIdBankIdParamSchema = OpsIdParamSchema.extend({
  bankId: z.coerce.number().int(),
});

export function operationsOrganizationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  // Organizations CRUD
  const listRoute = createRoute({
    method: "get", path: "/",
    tags: ["Operations - Organizations"], summary: "List organizations",
    request: { query: ListOrganizationsQuerySchema },
    responses: { 200: { content: { "application/json": { schema: PaginatedOrganizationsSchema } }, description: "OK" } },
  });
  const getRoute = createRoute({
    method: "get", path: "/{id}",
    tags: ["Operations - Organizations"], summary: "Get organization",
    request: { params: OpsIdParamSchema },
    responses: {
      200: { content: { "application/json": { schema: OrganizationSchema } }, description: "OK" },
      404: { content: { "application/json": { schema: OpsErrorSchema } }, description: "Not found" },
    },
  });
  const createRoute_ = createRoute({
    method: "post", path: "/",
    tags: ["Operations - Organizations"], summary: "Create organization",
    request: { body: { content: { "application/json": { schema: CreateOrganizationInputSchema } }, required: true } },
    responses: { 201: { content: { "application/json": { schema: OrganizationSchema } }, description: "Created" } },
  });
  const updateRoute = createRoute({
    method: "patch", path: "/{id}",
    tags: ["Operations - Organizations"], summary: "Update organization",
    request: { params: OpsIdParamSchema, body: { content: { "application/json": { schema: UpdateOrganizationInputSchema } }, required: true } },
    responses: { 200: { content: { "application/json": { schema: OrganizationSchema } }, description: "Updated" } },
  });
  const deleteRoute = createRoute({
    method: "delete", path: "/{id}",
    tags: ["Operations - Organizations"], summary: "Delete organization",
    request: { params: OpsIdParamSchema },
    responses: { 200: { content: { "application/json": { schema: OpsDeletedSchema } }, description: "Deleted" } },
  });

  // Bank details sub-routes
  const listBanksRoute = createRoute({
    method: "get", path: "/{id}/banks",
    tags: ["Operations - Organizations"], summary: "List bank details for organization",
    request: { params: OpsIdParamSchema, query: ListBankDetailsQuerySchema },
    responses: { 200: { content: { "application/json": { schema: PaginatedBankDetailsSchema } }, description: "OK" } },
  });
  const createBankRoute = createRoute({
    method: "post", path: "/{id}/banks",
    tags: ["Operations - Organizations"], summary: "Add bank details",
    request: { params: OpsIdParamSchema, body: { content: { "application/json": { schema: CreateBankDetailsInputSchema } }, required: true } },
    responses: { 201: { content: { "application/json": { schema: BankDetailsSchema } }, description: "Created" } },
  });
  const updateBankRoute = createRoute({
    method: "patch", path: "/{id}/banks/{bankId}",
    tags: ["Operations - Organizations"], summary: "Update bank details",
    request: { params: OpsIdBankIdParamSchema, body: { content: { "application/json": { schema: UpdateBankDetailsInputSchema } }, required: true } },
    responses: { 200: { content: { "application/json": { schema: BankDetailsSchema } }, description: "Updated" } },
  });
  const deleteBankRoute = createRoute({
    method: "delete", path: "/{id}/banks/{bankId}",
    tags: ["Operations - Organizations"], summary: "Delete bank details",
    request: { params: OpsIdBankIdParamSchema },
    responses: { 200: { content: { "application/json": { schema: OpsDeletedSchema } }, description: "Deleted" } },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.organizations.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const org = await ctx.operationsModule.organizations.queries.findById(id);
      if (!org) return c.json({ error: "Organization not found" }, 404);
      return c.json(org, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.organizations.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.organizations.commands.update({ ...input, id });
      return c.json(result, 200);
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      await ctx.operationsModule.organizations.commands.softDelete(id);
      return c.json({ deleted: true }, 200);
    })
    .openapi(listBanksRoute, async (c) => {
      const { id } = c.req.valid("param");
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.organizations.bankDetails.queries.list({
        ...query,
        organizationId: id,
      });
      return c.json(result, 200);
    })
    .openapi(createBankRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.organizations.bankDetails.commands.create({
        ...input,
        organizationId: id,
      });
      return c.json(result, 201);
    })
    .openapi(updateBankRoute, async (c) => {
      const { bankId } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.organizations.bankDetails.commands.update({
        ...input,
        id: bankId,
      });
      return c.json(result, 200);
    })
    .openapi(deleteBankRoute, async (c) => {
      const { bankId } = c.req.valid("param");
      await ctx.operationsModule.organizations.bankDetails.commands.softDelete(bankId);
      return c.json({ deleted: true }, 200);
    });
}
