import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { z } from "@hono/zod-openapi";

import {
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
  RequisiteProviderNotActiveError,
} from "@bedrock/parties";
import {
  CreateOrganizationInputSchema,
  CreateRequisiteInputSchema,
  ListOrganizationsQuerySchema,
  ListRequisitesQuerySchema,
  PartyProfileBundleInputSchema,
  PartyProfileBundleSchema,
  OrganizationOptionSchema,
  OrganizationOptionsResponseSchema,
  OrganizationListItemSchema,
  PaginatedOrganizationsSchema,
  OrganizationSchema,
  RequisiteListItemSchema,
  RequisiteSchema,
  UpdateOrganizationInputSchema,
} from "@bedrock/parties/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import {
  createPaginatedListSchema,
  MAX_QUERY_LIST_LIMIT,
} from "@bedrock/shared/core/pagination";

import { ErrorSchema, DeletedSchema, IdParamSchema } from "../common";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import { countOrganizationBankRequisites } from "./organization-requisites";
import {
  mapPartyProfileMutationError,
  replacePartyProfileBundle,
} from "./party-profile";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

interface OrganizationFilesResponse {
  banksCount: number;
  hasFiles: boolean;
  sealUrl: string | null;
  signatureUrl: string | null;
}

const OrganizationRequisitesQuerySchema = ListRequisitesQuerySchema.omit({
  ownerId: true,
  ownerType: true,
});
const CreateOrganizationRequisiteInputSchema = CreateRequisiteInputSchema.omit({
  ownerId: true,
  ownerType: true,
});
const PaginatedOrganizationRequisitesSchema = createPaginatedListSchema(
  RequisiteListItemSchema,
);
async function buildOrganizationListRow(
  ctx: AppContext,
  organization: z.infer<typeof OrganizationListItemSchema>,
) {
  const banksCount = await countOrganizationBankRequisites(ctx, organization.id);

  return {
    ...organization,
    banksCount,
    hasFiles: Boolean(organization.signatureKey || organization.sealKey),
  };
}

async function buildOrganizationDetail(
  ctx: AppContext,
  organization: z.infer<typeof OrganizationSchema>,
) {
  const banksCount = await countOrganizationBankRequisites(ctx, organization.id);

  return {
    ...organization,
    banksCount,
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

  const listRequisitesRoute = createRoute({
    middleware: [requirePermission({ requisites: ["list"] })],
    method: "get",
    path: "/{id}/requisites",
    tags: ["Organizations"],
    summary: "List organization requisites",
    request: {
      params: IdParamSchema,
      query: OrganizationRequisitesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedOrganizationRequisitesSchema,
          },
        },
        description: "Paginated list of organization requisites",
      },
      404: {
        content: {
          "application/json": { schema: ErrorSchema },
        },
        description: "Organization not found",
      },
    },
  });

  const createRequisiteRoute = createRoute({
    middleware: [requirePermission({ requisites: ["create"] })],
    method: "post",
    path: "/{id}/requisites",
    tags: ["Organizations"],
    summary: "Create organization requisite",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateOrganizationRequisiteInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: RequisiteSchema,
          },
        },
        description: "Organization requisite created",
      },
      400: {
        content: {
          "application/json": { schema: ErrorSchema },
        },
        description: "Validation error",
      },
      404: {
        content: {
          "application/json": { schema: ErrorSchema },
        },
        description: "Organization not found",
      },
    },
  });

  const putPartyProfileRoute = createRoute({
    middleware: [requirePermission({ organizations: ["update"] })],
    method: "put",
    path: "/{id}/party-profile",
    tags: ["Organizations"],
    summary: "Replace organization party profile data",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: PartyProfileBundleInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PartyProfileBundleSchema,
          },
        },
        description: "Organization party profile bundle updated",
      },
      400: {
        content: {
          "application/json": { schema: ErrorSchema },
        },
        description: "Validation error",
      },
      404: {
        content: {
          "application/json": { schema: ErrorSchema },
        },
        description: "Organization not found",
      },
    },
  });

  async function ensureOrganizationExists(id: string) {
    await ctx.partiesModule.organizations.queries.findById(id);
  }

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
        limit: MAX_QUERY_LIST_LIMIT,
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
    .openapi(listRequisitesRoute, async (c) => {
      const { id } = c.req.valid("param");
      const query = c.req.valid("query");

      try {
        await ensureOrganizationExists(id);
        const result = await ctx.partiesModule.requisites.queries.list({
          ...query,
          ownerId: id,
          ownerType: "organization",
        });
        return c.json(result, 200);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    })
    .openapi(createRequisiteRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        await ensureOrganizationExists(id);
        const requisite = await ctx.partiesModule.requisites.commands.create({
          ...input,
          ownerId: id,
          ownerType: "organization",
        });
        return c.json(requisite, 201);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (
          error instanceof ValidationError ||
          error instanceof RequisiteProviderNotActiveError
        ) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(putPartyProfileRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const organization =
          await ctx.partiesModule.organizations.queries.findById(id);
        const bundle = await replacePartyProfileBundle({
          bundle: input,
          ctx,
          ownerId: id,
          ownerType: "organization",
          party: organization,
        });
        return c.json(bundle, 200);
      } catch (error) {
        const handled = mapPartyProfileMutationError(
          error,
          OrganizationNotFoundError,
        );
        if (handled) {
          return c.json(handled.body, handled.status);
        }
        throw error;
      }
    })
    .get(
      "/:id/files",
      requirePermission({ organizations: ["list"] }),
      async (c) => {
        const id = c.req.param("id");

        try {
          const organization =
            await ctx.partiesModule.organizations.queries.findById(id);
          const banksCount = await countOrganizationBankRequisites(ctx, id);

          return c.json(
            {
              banksCount,
              hasFiles: Boolean(organization.signatureKey || organization.sealKey),
              signatureUrl: organization.signatureKey
                ? `/v1/organizations/${id}/files/signature`
                : null,
              sealUrl: organization.sealKey
                ? `/v1/organizations/${id}/files/seal`
                : null,
            } satisfies OrganizationFilesResponse,
            200,
          );
        } catch (error) {
          if (error instanceof OrganizationNotFoundError) {
            return c.json({ error: error.message }, 404);
          }
          throw error;
        }
      },
    )
    .get(
      "/:id/files/:type",
      requirePermission({ organizations: ["list"] }),
      async (c) => {
        const id = c.req.param("id");
        const type = c.req.param("type") as "signature" | "seal";
        if (type !== "signature" && type !== "seal") {
          return c.json({ error: "Type must be signature or seal" }, 400);
        }

        try {
          const organization =
            await ctx.partiesModule.organizations.queries.findById(id);
          const key =
            type === "signature"
              ? organization.signatureKey ?? null
              : organization.sealKey ?? null;

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
        } catch (error) {
          if (error instanceof OrganizationNotFoundError) {
            return c.json({ error: error.message }, 404);
          }
          throw error;
        }
      },
    )
    .post(
      "/:id/files",
      requirePermission({ organizations: ["update"] }),
      async (c) => {
        const id = c.req.param("id");

        try {
          await ctx.partiesModule.organizations.queries.findById(id);
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
            await ctx.partiesModule.organizations.commands.update(id, patch);
          }

          return c.json({ success: true }, 200);
        } catch (error) {
          if (error instanceof OrganizationNotFoundError) {
            return c.json({ error: error.message }, 404);
          }
          throw error;
        }
      },
    );
}
