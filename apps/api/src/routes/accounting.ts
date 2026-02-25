import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  accountNoSchema,
  replaceCorrespondenceRulesSchema,
  upsertOrgAccountOverrideSchema,
} from "@bedrock/accounting";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const OrgParamSchema = z.object({
  orgId: z.uuid(),
});

const OrgAccountParamSchema = z.object({
  orgId: z.uuid(),
  accountNo: accountNoSchema,
});

const TemplateAccountSchema = z.object({
  accountNo: z.string(),
  name: z.string(),
  kind: z.string(),
  normalSide: z.string(),
  postingAllowed: z.boolean(),
  parentAccountNo: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const OrgAccountSchema = z.object({
  orgId: z.uuid(),
  accountNo: z.string(),
  name: z.string(),
  kind: z.string(),
  normalSide: z.string(),
  postingAllowed: z.boolean(),
  enabled: z.boolean(),
});

const CorrespondenceRuleSchema = z.object({
  id: z.uuid(),
  scope: z.string(),
  orgId: z.uuid().nullable(),
  postingCode: z.string(),
  debitAccountNo: z.string(),
  creditAccountNo: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const SeedResultSchema = z.object({
  seeded: z.boolean(),
  accounts: z.number().int(),
  rules: z.number().int(),
});

export function accountingRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listTemplateAccountsRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/template/accounts",
    tags: ["Accounting"],
    summary: "List global chart template accounts",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(TemplateAccountSchema),
          },
        },
        description: "Template accounts",
      },
    },
  });

  const listOrgAccountsRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/orgs/{orgId}/accounts",
    tags: ["Accounting"],
    summary: "List effective org chart accounts",
    request: {
      params: OrgParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(OrgAccountSchema),
          },
        },
        description: "Org chart accounts",
      },
    },
  });

  const upsertOrgAccountRoute = createRoute({
    middleware: [requirePermission({ accounting: ["manage_accounts"] })],
    method: "put",
    path: "/orgs/{orgId}/accounts/{accountNo}",
    tags: ["Accounting"],
    summary: "Upsert org account override",
    request: {
      params: OrgAccountParamSchema,
      body: {
        content: {
          "application/json": {
            schema: upsertOrgAccountOverrideSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              orgId: z.uuid(),
              accountNo: z.string(),
              enabled: z.boolean(),
              nameOverride: z.string().nullable(),
              createdAt: z.string().datetime(),
              updatedAt: z.string().datetime(),
            }),
          },
        },
        description: "Override saved",
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

  const listRulesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/orgs/{orgId}/correspondence-rules",
    tags: ["Accounting"],
    summary: "List org correspondence rules",
    request: {
      params: OrgParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(CorrespondenceRuleSchema),
          },
        },
        description: "Rules",
      },
    },
  });

  const replaceRulesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["manage_correspondence"] })],
    method: "put",
    path: "/orgs/{orgId}/correspondence-rules",
    tags: ["Accounting"],
    summary: "Replace org correspondence rules",
    request: {
      params: OrgParamSchema,
      body: {
        content: {
          "application/json": {
            schema: replaceCorrespondenceRulesSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(CorrespondenceRuleSchema),
          },
        },
        description: "Rules replaced",
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

  const seedRoute = createRoute({
    middleware: [requirePermission({ accounting: ["seed"] })],
    method: "post",
    path: "/orgs/{orgId}/seed-defaults",
    tags: ["Accounting"],
    summary: "Seed default accounting setup for org",
    request: {
      params: OrgParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: SeedResultSchema,
          },
        },
        description: "Seed result",
      },
    },
  });

  return app
    .openapi(listTemplateAccountsRoute, async (c) => {
      const rows = await ctx.accountingService.listTemplateAccounts();
      return c.json(
        rows.map((row) => ({
          accountNo: row.accountNo,
          name: row.name,
          kind: row.kind,
          normalSide: row.normalSide,
          postingAllowed: row.postingAllowed,
          parentAccountNo: row.parentAccountNo,
          createdAt: row.createdAt.toISOString(),
        })),
        200,
      );
    })
    .openapi(listOrgAccountsRoute, async (c) => {
      const { orgId } = c.req.valid("param");
      const rows = await ctx.accountingService.listOrgAccounts(orgId);
      return c.json(rows, 200);
    })
    .openapi(upsertOrgAccountRoute, async (c) => {
      try {
        const { orgId, accountNo } = c.req.valid("param");
        const body = c.req.valid("json");
        const row = await ctx.accountingService.upsertOrgAccountOverride(
          orgId,
          accountNo,
          body,
        );
        return c.json(
          {
            orgId: row.orgId,
            accountNo: row.accountNo,
            enabled: row.enabled,
            nameOverride: row.nameOverride,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          },
          200,
        );
      } catch (error) {
        return c.json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          400,
        );
      }
    })
    .openapi(listRulesRoute, async (c) => {
      const { orgId } = c.req.valid("param");
      const rows = await ctx.accountingService.listCorrespondenceRules(orgId);
      return c.json(
        rows.map((row) => ({
          id: row.id,
          scope: row.scope,
          orgId: row.orgId,
          postingCode: row.postingCode,
          debitAccountNo: row.debitAccountNo,
          creditAccountNo: row.creditAccountNo,
          enabled: row.enabled,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
        200,
      );
    })
    .openapi(replaceRulesRoute, async (c) => {
      try {
        const { orgId } = c.req.valid("param");
        const body = c.req.valid("json");
        const rows = await ctx.accountingService.replaceCorrespondenceRules(
          orgId,
          body,
        );
        return c.json(
          rows.map((row) => ({
            id: row.id,
            scope: row.scope,
            orgId: row.orgId,
            postingCode: row.postingCode,
            debitAccountNo: row.debitAccountNo,
            creditAccountNo: row.creditAccountNo,
            enabled: row.enabled,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          })),
          200,
        );
      } catch (error) {
        return c.json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          400,
        );
      }
    })
    .openapi(seedRoute, async (c) => {
      const { orgId } = c.req.valid("param");
      const result = await ctx.accountingService.seedDefaults(orgId);
      return c.json(result, 200);
    });
}
