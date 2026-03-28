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
    request: { params: OpsIdParamSchema, body: { content: { "application/json": { schema: UpdateOrganizationInputSchema.omit({ id: true }) } }, required: true } },
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
  const CreateBankDetailsBodySchema = CreateBankDetailsInputSchema.omit({
    organizationId: true,
  });
  const createBankRoute = createRoute({
    method: "post", path: "/{id}/banks",
    tags: ["Operations - Organizations"], summary: "Add bank details",
    request: { params: OpsIdParamSchema, body: { content: { "application/json": { schema: CreateBankDetailsBodySchema } }, required: true } },
    responses: { 201: { content: { "application/json": { schema: BankDetailsSchema } }, description: "Created" } },
  });
  const updateBankRoute = createRoute({
    method: "patch", path: "/{id}/banks/{bankId}",
    tags: ["Operations - Organizations"], summary: "Update bank details",
    request: { params: OpsIdBankIdParamSchema, body: { content: { "application/json": { schema: UpdateBankDetailsInputSchema.omit({ id: true }) } }, required: true } },
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
      const enriched = result.data.map((org: any) => ({
        ...org,
        hasFiles: !!(org.signatureKey || org.sealKey),
      }));
      return c.json({ ...result, data: enriched }, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const org = await ctx.operationsModule.organizations.queries.findById(id);
      if (!org) return c.json({ error: "Organization not found" }, 404);
      const banksResult = await ctx.operationsModule.organizations.bankDetails.queries.list({
        organizationId: id,
        limit: 200,
        offset: 0,
      });
      const signatureUrl = (org as any).signatureKey
        ? `/organizations/${id}/files/signature`
        : null;
      const sealUrl = (org as any).sealKey
        ? `/organizations/${id}/files/seal`
        : null;
      return c.json({ ...org, banks: banksResult.data, signatureUrl, sealUrl }, 200);
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
    })
    .get("/:id/files", async (c) => {
      const id = Number(c.req.param("id"));
      const org = await ctx.operationsModule.organizations.queries.findById(id);
      if (!org) return c.json({ signatureUrl: null, sealUrl: null }, 200);
      const hasSignature = !!(org as any).signatureKey;
      const hasSeal = !!(org as any).sealKey;
      return c.json({
        hasFiles: hasSignature || hasSeal,
        signatureUrl: hasSignature ? `/v1/operations/organizations/${id}/files/signature` : null,
        sealUrl: hasSeal ? `/v1/operations/organizations/${id}/files/seal` : null,
      }, 200);
    })
    .get("/:id/files/:type", async (c) => {
      const id = Number(c.req.param("id"));
      const type = c.req.param("type") as "signature" | "seal";
      if (type !== "signature" && type !== "seal") {
        return c.json({ error: "Type must be signature or seal" }, 400);
      }
      const org = await ctx.operationsModule.organizations.queries.findById(id);
      if (!org) return c.json({ error: "Organization not found" }, 404);
      const key = type === "signature" ? (org as any).signatureKey : (org as any).sealKey;
      if (!key) return c.json({ error: "File not found" }, 404);
      if (!ctx.objectStorage) return c.json({ error: "Storage not configured" }, 503);
      const buffer = await ctx.objectStorage.download(key);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    })
    .post("/:id/files", async (c) => {
      const id = Number(c.req.param("id"));
      const body = await c.req.parseBody();
      const signatureFile = body.signature;
      const sealFile = body.seal;

      const updates: Record<string, string | null> = {};

      if (!ctx.objectStorage) return c.json({ error: "Storage not configured" }, 503);

      if (signatureFile && typeof signatureFile !== "string") {
        const key = `organizations/${id}/signature.png`;
        const buffer = Buffer.from(await signatureFile.arrayBuffer());
        await ctx.objectStorage!.upload(key, buffer, "image/png");
        updates.signatureKey = key;
      }

      if (sealFile && typeof sealFile !== "string") {
        const key = `organizations/${id}/seal.png`;
        const buffer = Buffer.from(await sealFile.arrayBuffer());
        await ctx.objectStorage!.upload(key, buffer, "image/png");
        updates.sealKey = key;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.operationsModule.organizations.commands.update({ id, ...updates } as any);
      }

      return c.json({ success: true }, 200);
    });
}
