import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  BankDetailsSchema,
  CreateBankDetailsInputSchema,
  ListBankDetailsQuerySchema,
  UpdateBankDetailsInputSchema,
} from "@bedrock/operations/contracts";
import {
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
} from "@bedrock/parties";
import {
  CreateOrganizationInputSchema,
  ListOrganizationsQuerySchema,
  OrganizationOptionSchema,
  OrganizationOptionsResponseSchema,
  OrganizationSchema,
  UpdateOrganizationInputSchema,
} from "@bedrock/parties/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  createHoldingOrganizationBridge,
  resolveLegacyHoldingOrganizationByCanonicalId,
} from "./organization-bridge";

const PaginatedOrganizationsSchema =
  createPaginatedListSchema(OrganizationSchema);
const OrganizationBankSchema = BankDetailsSchema.extend({
  organizationId: z.string().uuid(),
});
const PaginatedOrganizationBanksSchema = createPaginatedListSchema(
  OrganizationBankSchema,
);
const OrganizationFilesSchema = z.object({
  hasFiles: z.boolean(),
  sealUrl: z.string().nullable(),
  signatureUrl: z.string().nullable(),
});
const OPTIONS_LIMIT = 200;

const OrganizationBankIdParamSchema = IdParamSchema.extend({
  bankId: z.coerce.number().int().openapi({
    param: {
      in: "path",
      name: "bankId",
    },
  }),
});

function serializeOrganizationBank(
  organizationId: string,
  bank: z.infer<typeof BankDetailsSchema>,
) {
  return {
    ...bank,
    organizationId,
  };
}

async function resolveHoldingOrganizationBridgeOrThrow(
  organizationId: string,
) {
  return resolveLegacyHoldingOrganizationByCanonicalId(organizationId);
}

async function syncHoldingOrganizationBridge(
  organization: z.infer<typeof OrganizationSchema>,
) {
  const bridge = createHoldingOrganizationBridge();
  return bridge.upsertFromCanonical(organization);
}

async function buildOrganizationListRow(
  ctx: AppContext,
  organization: z.infer<typeof OrganizationSchema>,
) {
  const bridge = createHoldingOrganizationBridge();
  const legacyOrganization =
    await bridge.findByCanonicalOrganizationId(organization.id);
  const banks = legacyOrganization
    ? await ctx.operationsModule.organizations.bankDetails.queries.listByOrganizationId(
        legacyOrganization.id,
      )
    : [];

  return {
    ...organization,
    banksCount: banks.length,
    hasFiles: Boolean(organization.signatureKey || organization.sealKey),
  };
}

async function buildOrganizationDetail(
  ctx: AppContext,
  organization: z.infer<typeof OrganizationSchema>,
) {
  const bridge = createHoldingOrganizationBridge();
  const legacyOrganization =
    await bridge.findByCanonicalOrganizationId(organization.id);
  const banks = legacyOrganization
    ? await ctx.operationsModule.organizations.bankDetails.queries.listByOrganizationId(
        legacyOrganization.id,
      )
    : [];

  return {
    ...organization,
    banks: banks.map((bank) => serializeOrganizationBank(organization.id, bank)),
    hasFiles: Boolean(organization.signatureKey || organization.sealKey),
    sealUrl: organization.sealKey
      ? `/v1/organizations/${organization.id}/files/seal`
      : null,
    signatureUrl: organization.signatureKey
      ? `/v1/organizations/${organization.id}/files/signature`
      : null,
  };
}

export function organizationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ organizations: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Organizations"],
    summary: "List organizations",
    request: {
      query: ListOrganizationsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedOrganizationsSchema,
          },
        },
        description: "Paginated list of organizations",
      },
    },
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ organizations: ["list"] })],
    method: "get",
    path: "/options",
    tags: ["Organizations"],
    summary: "List organization options",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationOptionsResponseSchema,
          },
        },
        description: "Organization option list",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ organizations: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Organizations"],
    summary: "Create an organization",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateOrganizationInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: OrganizationSchema,
          },
        },
        description: "Organization created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ organizations: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Organizations"],
    summary: "Get organization by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationSchema,
          },
        },
        description: "Organization found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization not found",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ organizations: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Organizations"],
    summary: "Update organization",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateOrganizationInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationSchema,
          },
        },
        description: "Organization updated",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization not found",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ organizations: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Organizations"],
    summary: "Archive organization",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DeletedSchema,
          },
        },
        description: "Organization archived",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization is still referenced",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Organization not found",
      },
    },
  });

  const listBanksRoute = createRoute({
    middleware: [requirePermission({ organizations: ["list"] })],
    method: "get",
    path: "/{id}/banks",
    tags: ["Organizations"],
    summary: "List organization bank details",
    request: {
      params: IdParamSchema,
      query: ListBankDetailsQuerySchema.omit({ organizationId: true }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedOrganizationBanksSchema,
          },
        },
        description: "Paginated list of organization bank details",
      },
    },
  });

  const createBankRoute = createRoute({
    middleware: [requirePermission({ organizations: ["update"] })],
    method: "post",
    path: "/{id}/banks",
    tags: ["Organizations"],
    summary: "Create organization bank details",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateBankDetailsInputSchema.omit({ organizationId: true }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: OrganizationBankSchema,
          },
        },
        description: "Organization bank details created",
      },
    },
  });

  const updateBankRoute = createRoute({
    middleware: [requirePermission({ organizations: ["update"] })],
    method: "patch",
    path: "/{id}/banks/{bankId}",
    tags: ["Organizations"],
    summary: "Update organization bank details",
    request: {
      params: OrganizationBankIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateBankDetailsInputSchema.omit({
              id: true,
              organizationId: true,
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OrganizationBankSchema,
          },
        },
        description: "Organization bank details updated",
      },
    },
  });

  const deleteBankRoute = createRoute({
    middleware: [requirePermission({ organizations: ["update"] })],
    method: "delete",
    path: "/{id}/banks/{bankId}",
    tags: ["Organizations"],
    summary: "Delete organization bank details",
    request: {
      params: OrganizationBankIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DeletedSchema,
          },
        },
        description: "Organization bank details deleted",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.organizations.queries.list({
        ...query,
        isActive: query.isActive ?? true,
      });
      const data = await Promise.all(
        result.data.map((organization) => buildOrganizationListRow(ctx, organization)),
      );
      return c.json({ ...result, data }, 200);
    })
    .openapi(optionsRoute, async (c) => {
      const result = await ctx.partiesModule.organizations.queries.list({
        isActive: true,
        limit: OPTIONS_LIMIT,
        offset: 0,
        sortBy: "shortName",
        sortOrder: "asc",
      });

      return c.json(
        buildOptionsResponse(result.data, (item) =>
          OrganizationOptionSchema.parse({
            id: item.id,
            shortName: item.shortName,
            label: item.shortName,
          }),
        ),
        200,
      );
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");

      try {
        const organization =
          await ctx.organizationBootstrapWorkflow.create(input);
        return c.json(organization, 201);
      } catch (error) {
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const organization =
          await ctx.partiesModule.organizations.queries.findById(id);
        return c.json(await buildOrganizationDetail(ctx, organization), 200);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const organization =
          await ctx.partiesModule.organizations.commands.update(id, input);
        await syncHoldingOrganizationBridge(organization);
        return c.json(organization, 200);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.partiesModule.organizations.commands.remove(id);
        await createHoldingOrganizationBridge().archiveByCanonicalOrganizationId(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof OrganizationDeleteConflictError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(listBanksRoute, async (c) => {
      const { id } = c.req.valid("param");
      const query = c.req.valid("query");
      const legacyOrganization = await resolveHoldingOrganizationBridgeOrThrow(id);
      const result = await ctx.operationsModule.organizations.bankDetails.queries.list({
        ...query,
        organizationId: legacyOrganization.id,
      });
      return c.json(
        {
          ...result,
          data: result.data.map((bank) => serializeOrganizationBank(id, bank)),
        },
        200,
      );
    })
    .openapi(createBankRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const legacyOrganization = await resolveHoldingOrganizationBridgeOrThrow(id);
      const result = await ctx.operationsModule.organizations.bankDetails.commands.create(
        {
          ...input,
          organizationId: legacyOrganization.id,
        },
      );
      return c.json(serializeOrganizationBank(id, result), 201);
    })
    .openapi(updateBankRoute, async (c) => {
      const { bankId, id } = c.req.valid("param");
      const input = c.req.valid("json");
      await resolveHoldingOrganizationBridgeOrThrow(id);
      const result = await ctx.operationsModule.organizations.bankDetails.commands.update(
        {
          ...input,
          id: bankId,
        },
      );
      return c.json(serializeOrganizationBank(id, result), 200);
    })
    .openapi(deleteBankRoute, async (c) => {
      const { bankId, id } = c.req.valid("param");
      await resolveHoldingOrganizationBridgeOrThrow(id);
      await ctx.operationsModule.organizations.bankDetails.commands.softDelete(bankId);
      return c.json({ deleted: true }, 200);
    })
    .get("/:id/files", async (c) => {
      const id = c.req.param("id");
      const organization = await ctx.partiesModule.organizations.queries.findById(id);
      return c.json(
        {
          hasFiles: Boolean(organization.signatureKey || organization.sealKey),
          signatureUrl: organization.signatureKey
            ? `/v1/organizations/${id}/files/signature`
            : null,
          sealUrl: organization.sealKey
            ? `/v1/organizations/${id}/files/seal`
            : null,
        } satisfies z.infer<typeof OrganizationFilesSchema>,
        200,
      );
    })
    .get("/:id/files/:type", async (c) => {
      const id = c.req.param("id");
      const type = c.req.param("type") as "signature" | "seal";
      if (type !== "signature" && type !== "seal") {
        return c.json({ error: "Type must be signature or seal" }, 400);
      }

      const organization = await ctx.partiesModule.organizations.queries.findById(id);
      const bridge = createHoldingOrganizationBridge();
      const legacyOrganization =
        await bridge.findByCanonicalOrganizationId(id);
      const key =
        type === "signature"
          ? organization.signatureKey ?? legacyOrganization?.signatureKey ?? null
          : organization.sealKey ?? legacyOrganization?.sealKey ?? null;

      if (!key) {
        return c.json({ error: "File not found" }, 404);
      }
      if (!ctx.objectStorage) {
        return c.json({ error: "Storage not configured" }, 503);
      }

      const buffer = await ctx.objectStorage.download(key);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Content-Type": "image/png",
        },
      });
    })
    .post("/:id/files", async (c) => {
      const id = c.req.param("id");
      const body = await c.req.parseBody();
      const signatureFile = body.signature;
      const sealFile = body.seal;

      if (!ctx.objectStorage) {
        return c.json({ error: "Storage not configured" }, 503);
      }

      const patch: z.input<typeof UpdateOrganizationInputSchema> = {};

      if (signatureFile && typeof signatureFile !== "string") {
        const key = `organizations/${id}/signature.png`;
        const buffer = Buffer.from(await signatureFile.arrayBuffer());
        await ctx.objectStorage.upload(key, buffer, "image/png");
        patch.signatureKey = key;
      }

      if (sealFile && typeof sealFile !== "string") {
        const key = `organizations/${id}/seal.png`;
        const buffer = Buffer.from(await sealFile.arrayBuffer());
        await ctx.objectStorage.upload(key, buffer, "image/png");
        patch.sealKey = key;
      }

      if (Object.keys(patch).length > 0) {
        const organization =
          await ctx.partiesModule.organizations.commands.update(id, patch);
        await syncHoldingOrganizationBridge(organization);
      }

      return c.json({ success: true }, 200);
    });
}
