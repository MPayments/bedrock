import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  FinancialResultsByCounterpartyResponseSchema,
  FinancialResultsByGroupResponseSchema,
  ListFinancialResultsByCounterpartyQuerySchema,
  ListFinancialResultsByGroupQuerySchema,
} from "@bedrock/application/accounting-reporting";
import { replaceCorrespondenceRulesSchema } from "@bedrock/core/accounting";
import {
  AccountingCorrespondenceRuleSchema,
  AccountingTemplateAccountSchema,
} from "@bedrock/core/accounting/contracts";
import { ListLedgerOperationsQuerySchema } from "@bedrock/core/ledger";
import { ValidationError } from "@bedrock/kernel/errors";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  mapCounterpartyBalanceDto,
  mapFinancialResultRowDto,
  mapFinancialSummaryDto,
  mapOperationDetailsDto,
} from "./accounting/mappers";

const OperationParamSchema = z.object({
  operationId: z.uuid(),
});

const ValidatePostingMatrixResultSchema = z.object({
  ok: z.boolean(),
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      postingCode: z.string().optional(),
      accountNo: z.string().optional(),
    }),
  ),
});

const LedgerOperationSummarySchema = z.object({
  id: z.uuid(),
  sourceType: z.string(),
  sourceId: z.string(),
  operationCode: z.string(),
  operationVersion: z.number().int(),
  postingDate: z.iso.datetime(),
  status: z.enum(["pending", "posted", "failed"]),
  error: z.string().nullable(),
  postedAt: z.iso.datetime().nullable(),
  outboxAttempts: z.number().int(),
  lastOutboxErrorAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  postingCount: z.number().int(),
  bookIds: z.array(z.string()),
  bookLabels: z.record(z.string(), z.string()),
  currencies: z.array(z.string()),
});

const PaginatedLedgerOperationsSchema = createPaginatedListSchema(
  LedgerOperationSummarySchema,
);

const DimensionsSchema = z.record(z.string(), z.string()).nullable();

const LedgerOperationPostingSchema = z.object({
  id: z.uuid(),
  lineNo: z.number().int(),
  bookId: z.uuid(),
  bookName: z.string().nullable(),
  debitInstanceId: z.uuid(),
  debitAccountNo: z.string().nullable(),
  debitDimensions: DimensionsSchema,
  creditInstanceId: z.uuid(),
  creditAccountNo: z.string().nullable(),
  creditDimensions: DimensionsSchema,
  postingCode: z.string(),
  currency: z.string(),
  currencyPrecision: z.number().int(),
  amount: z.string(),
  memo: z.string().nullable(),
  context: z.record(z.string(), z.string()).nullable(),
  createdAt: z.iso.datetime(),
});

const LedgerOperationTbPlanSchema = z.object({
  id: z.uuid(),
  lineNo: z.number().int(),
  type: z.enum(["create", "post_pending", "void_pending"]),
  transferId: z.string(),
  debitTbAccountId: z.string().nullable(),
  creditTbAccountId: z.string().nullable(),
  tbLedger: z.number().int(),
  amount: z.string(),
  code: z.number().int(),
  pendingRef: z.string().nullable(),
  pendingId: z.string().nullable(),
  isLinked: z.boolean(),
  isPending: z.boolean(),
  timeoutSeconds: z.number().int(),
  status: z.enum(["pending", "posted", "failed"]),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

const LedgerOperationDetailsSchema = z.object({
  operation: LedgerOperationSummarySchema,
  postings: z.array(LedgerOperationPostingSchema),
  tbPlans: z.array(LedgerOperationTbPlanSchema),
  dimensionLabels: z.record(z.string(), z.string()),
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
            schema: z.array(AccountingTemplateAccountSchema),
          },
        },
        description: "Template accounts",
      },
    },
  });

  const listRulesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/correspondence-rules",
    tags: ["Accounting"],
    summary: "List global correspondence rules",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(AccountingCorrespondenceRuleSchema),
          },
        },
        description: "Rules",
      },
    },
  });

  const replaceRulesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["manage_correspondence"] })],
    method: "put",
    path: "/correspondence-rules",
    tags: ["Accounting"],
    summary: "Replace global correspondence rules",
    request: {
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
            schema: z.array(AccountingCorrespondenceRuleSchema),
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

  const validatePostingMatrixRoute = createRoute({
    middleware: [requirePermission({ accounting: ["manage_correspondence"] })],
    method: "post",
    path: "/correspondence-rules/validate",
    tags: ["Accounting"],
    summary: "Validate posting matrix and account analytics consistency",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ValidatePostingMatrixResultSchema,
          },
        },
        description: "Validation result",
      },
    },
  });

  const listOperationsRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/operations",
    tags: ["Accounting"],
    summary: "List accounting operations journal",
    request: {
      query: ListLedgerOperationsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedLedgerOperationsSchema,
          },
        },
        description: "Paginated operations list",
      },
    },
  });

  const getOperationRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/operations/{operationId}",
    tags: ["Accounting"],
    summary: "Get accounting operation details",
    request: {
      params: OperationParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: LedgerOperationDetailsSchema,
          },
        },
        description: "Operation details",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Operation not found",
      },
    },
  });

  const listFinancialResultsByCounterpartyRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/financial-results/counterparties",
    tags: ["Accounting"],
    summary: "List financial results by counterparty attribution",
    request: {
      query: ListFinancialResultsByCounterpartyQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FinancialResultsByCounterpartyResponseSchema,
          },
        },
        description: "Paginated financial result rows by counterparty",
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

  const getCounterpartyAccountBalancesRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/counterparty-account-balances",
    tags: ["Accounting"],
    summary: "Get posted balances for counterparty accounts by their IDs",
    request: {
      query: z.object({
        counterpartyAccountIds: z
          .string()
          .describe("Comma-separated list of counterparty account IDs"),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                counterpartyAccountId: z.string().uuid(),
                currency: z.string(),
                balance: z.string(),
                precision: z.number().int(),
              }),
            ),
          },
        },
        description: "Balances per counterparty account and currency",
      },
    },
  });

  const listFinancialResultsByGroupRoute = createRoute({
    middleware: [requirePermission({ accounting: ["list"] })],
    method: "get",
    path: "/financial-results/groups",
    tags: ["Accounting"],
    summary: "List financial results by group attribution",
    request: {
      query: ListFinancialResultsByGroupQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FinancialResultsByGroupResponseSchema,
          },
        },
        description: "Paginated financial result rows by groups",
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
          enabled: row.enabled,
          parentAccountNo: row.parentAccountNo,
          createdAt: row.createdAt.toISOString(),
        })),
        200,
      );
    })
    .openapi(listRulesRoute, async (c) => {
      const rows = await ctx.accountingService.listCorrespondenceRules();
      return c.json(
        rows.map((row) => ({
          id: row.id,
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
        const body = c.req.valid("json");
        const rows =
          await ctx.accountingService.replaceCorrespondenceRules(body);
        return c.json(
          rows.map((row) => ({
            id: row.id,
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
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(validatePostingMatrixRoute, async (c) => {
      const result = await ctx.accountingService.validatePostingMatrix();
      return c.json(result, 200);
    })
    .openapi(listOperationsRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.accountingReportingService.listOperationsWithLabels(query);

      return c.json(
        {
          ...result,
          data: result.data.map((row) => ({
            ...row,
            postingDate: row.postingDate.toISOString(),
            postedAt: row.postedAt?.toISOString() ?? null,
            lastOutboxErrorAt: row.lastOutboxErrorAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
          })),
        },
        200,
      );
    })
    .openapi(getOperationRoute, async (c) => {
      const { operationId } = c.req.valid("param");
      const details =
        await ctx.accountingReportingService.getOperationDetailsWithLabels(
          operationId,
        );

      if (!details) {
        return c.json({ error: `Operation not found: ${operationId}` }, 404);
      }

      return c.json(mapOperationDetailsDto(details), 200);
    })
    .openapi(listFinancialResultsByCounterpartyRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result =
          await ctx.accountingReportingService.listFinancialResultsByCounterparty(
            query,
          );

        return c.json(
          {
            ...result,
            data: result.data.map(mapFinancialResultRowDto),
            summaryByCurrency: result.summaryByCurrency.map(
              mapFinancialSummaryDto,
            ),
          },
          200,
        );
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    })
    .openapi(getCounterpartyAccountBalancesRoute, async (c) => {
      const { counterpartyAccountIds: accountIdsParam } = c.req.valid("query");
      const counterpartyAccountIds = accountIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      const balances =
        await ctx.balancesService.listBalancesByCounterpartyAccountIds(
          counterpartyAccountIds,
        );

      return c.json(
        balances.map(mapCounterpartyBalanceDto),
        200,
      );
    })
    .openapi(listFinancialResultsByGroupRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result =
          await ctx.accountingReportingService.listFinancialResultsByGroup(
            query,
          );

        return c.json(
          {
            ...result,
            data: result.data.map(mapFinancialResultRowDto),
            summaryByCurrency: result.summaryByCurrency.map(
              mapFinancialSummaryDto,
            ),
            unattributedByCurrency: result.unattributedByCurrency.map(
              mapFinancialSummaryDto,
            ),
          },
          200,
        );
      } catch (error) {
        if (error instanceof ValidationError || error instanceof z.ZodError) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    });
}
