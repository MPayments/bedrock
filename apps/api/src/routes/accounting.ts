import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  ListAccountingOperationsQuerySchema,
  ListFinancialResultsByCounterpartyQuerySchema,
  ListFinancialResultsByGroupQuerySchema,
  replaceCorrespondenceRulesSchema,
} from "@bedrock/accounting";
import { createPaginatedListSchema } from "@bedrock/kernel/pagination";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const OperationParamSchema = z.object({
  operationId: z.uuid(),
});

const TemplateAccountSchema = z.object({
  accountNo: z.string(),
  name: z.string(),
  kind: z.string(),
  normalSide: z.string(),
  postingAllowed: z.boolean(),
  enabled: z.boolean(),
  parentAccountNo: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const CorrespondenceRuleSchema = z.object({
  id: z.uuid(),
  postingCode: z.string(),
  debitAccountNo: z.string(),
  creditAccountNo: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
  postingDate: z.string().datetime(),
  status: z.enum(["pending", "posted", "failed"]),
  error: z.string().nullable(),
  postedAt: z.string().datetime().nullable(),
  outboxAttempts: z.number().int(),
  lastOutboxErrorAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  postingCount: z.number().int(),
  bookOrgIds: z.array(z.string()),
  currencies: z.array(z.string()),
});

const PaginatedLedgerOperationsSchema = createPaginatedListSchema(
  LedgerOperationSummarySchema,
);

const DimensionsSchema = z.record(z.string(), z.string()).nullable();

const LedgerOperationPostingSchema = z.object({
  id: z.uuid(),
  lineNo: z.number().int(),
  bookOrgId: z.uuid(),
  bookOrgName: z.string().nullable(),
  debitInstanceId: z.uuid(),
  debitAccountNo: z.string().nullable(),
  debitDimensions: DimensionsSchema,
  creditInstanceId: z.uuid(),
  creditAccountNo: z.string().nullable(),
  creditDimensions: DimensionsSchema,
  postingCode: z.string(),
  currency: z.string(),
  amountMinor: z.string(),
  memo: z.string().nullable(),
  context: z.record(z.string(), z.string()).nullable(),
  createdAt: z.string().datetime(),
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
  createdAt: z.string().datetime(),
});

const LedgerOperationDetailsSchema = z.object({
  operation: LedgerOperationSummarySchema,
  postings: z.array(LedgerOperationPostingSchema),
  tbPlans: z.array(LedgerOperationTbPlanSchema),
});

const FinancialResultSummaryByCurrencySchema = z.object({
  currency: z.string(),
  revenueMinor: z.string(),
  expenseMinor: z.string(),
  netMinor: z.string(),
});

const FinancialResultByCounterpartyRowSchema = z.object({
  entityType: z.enum(["counterparty", "unattributed"]),
  counterpartyId: z.uuid().nullable(),
  counterpartyName: z.string().nullable(),
  currency: z.string(),
  revenueMinor: z.string(),
  expenseMinor: z.string(),
  netMinor: z.string(),
});

const FinancialResultByGroupRowSchema = z.object({
  groupId: z.uuid(),
  groupCode: z.string().nullable(),
  groupName: z.string().nullable(),
  currency: z.string(),
  revenueMinor: z.string(),
  expenseMinor: z.string(),
  netMinor: z.string(),
});

const FinancialResultsByCounterpartyResponseSchema = createPaginatedListSchema(
  FinancialResultByCounterpartyRowSchema,
).extend({
  summaryByCurrency: z.array(FinancialResultSummaryByCurrencySchema),
});

const FinancialResultsByGroupResponseSchema = createPaginatedListSchema(
  FinancialResultByGroupRowSchema,
).extend({
  summaryByCurrency: z.array(FinancialResultSummaryByCurrencySchema),
  unattributedByCurrency: z.array(FinancialResultSummaryByCurrencySchema),
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
      query: ListAccountingOperationsQuerySchema,
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
        return c.json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          400,
        );
      }
    })
    .openapi(validatePostingMatrixRoute, async (c) => {
      const result = await ctx.accountingService.validatePostingMatrix();
      return c.json(result, 200);
    })
    .openapi(listOperationsRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.ledgerReadService.listOperations(query);

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
        await ctx.ledgerReadService.getOperationDetails(operationId);

      if (!details) {
        return c.json({ error: `Operation not found: ${operationId}` }, 404);
      }

      return c.json(
        {
          operation: {
            ...details.operation,
            postingDate: details.operation.postingDate.toISOString(),
            postedAt: details.operation.postedAt?.toISOString() ?? null,
            lastOutboxErrorAt:
              details.operation.lastOutboxErrorAt?.toISOString() ?? null,
            createdAt: details.operation.createdAt.toISOString(),
          },
          postings: details.postings.map((posting) => ({
            ...posting,
            amountMinor: posting.amountMinor.toString(),
            createdAt: posting.createdAt.toISOString(),
          })),
          tbPlans: details.tbPlans.map((plan) => ({
            ...plan,
            transferId: plan.transferId.toString(),
            debitTbAccountId: plan.debitTbAccountId?.toString() ?? null,
            creditTbAccountId: plan.creditTbAccountId?.toString() ?? null,
            amount: plan.amount.toString(),
            pendingId: plan.pendingId?.toString() ?? null,
            createdAt: plan.createdAt.toISOString(),
          })),
        },
        200,
      );
    })
    .openapi(listFinancialResultsByCounterpartyRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result =
          await ctx.accountingService.listFinancialResultsByCounterparty(query);

        return c.json(
          {
            ...result,
            data: result.data.map((row) => ({
              ...row,
              revenueMinor: row.revenueMinor.toString(),
              expenseMinor: row.expenseMinor.toString(),
              netMinor: row.netMinor.toString(),
            })),
            summaryByCurrency: result.summaryByCurrency.map((row) => ({
              ...row,
              revenueMinor: row.revenueMinor.toString(),
              expenseMinor: row.expenseMinor.toString(),
              netMinor: row.netMinor.toString(),
            })),
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
    .openapi(listFinancialResultsByGroupRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result =
          await ctx.accountingService.listFinancialResultsByGroup(query);

        return c.json(
          {
            ...result,
            data: result.data.map((row) => ({
              ...row,
              revenueMinor: row.revenueMinor.toString(),
              expenseMinor: row.expenseMinor.toString(),
              netMinor: row.netMinor.toString(),
            })),
            summaryByCurrency: result.summaryByCurrency.map((row) => ({
              ...row,
              revenueMinor: row.revenueMinor.toString(),
              expenseMinor: row.expenseMinor.toString(),
              netMinor: row.netMinor.toString(),
            })),
            unattributedByCurrency: result.unattributedByCurrency.map(
              (row) => ({
                ...row,
                revenueMinor: row.revenueMinor.toString(),
                expenseMinor: row.expenseMinor.toString(),
                netMinor: row.netMinor.toString(),
              }),
            ),
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
    });
}
