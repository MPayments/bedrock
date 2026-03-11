import { z } from "zod";

import { PaginationInputSchema } from "@multihansa/common/pagination";

const uuidSchema = z.uuid({ version: "v4" });
const dateTimeSchema = z.iso.datetime();
const financialStatusSchema = z.enum(["pending", "posted", "failed"]);

function toArray(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues.flatMap((item) => {
    if (typeof item !== "string") {
      return [item];
    }

    return item
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  });
}

const uuidArrayQuerySchema = z.preprocess(
  toArray,
  z.array(uuidSchema).optional(),
);

const statusArrayQuerySchema = z
  .preprocess(toArray, z.array(financialStatusSchema).optional())
  .transform((value) => (value && value.length > 0 ? value : ["posted"]));

const scopeTypeSchema = z
  .enum(["all", "counterparty", "group", "book"])
  .default("all");

const attributionModeSchema = z
  .enum(["analytic_counterparty", "book_org"])
  .default("analytic_counterparty");

const reportScopeQuerySchema = z
  .object({
    scopeType: scopeTypeSchema,
    counterpartyId: uuidArrayQuerySchema.optional().default([]),
    groupId: uuidArrayQuerySchema.optional().default([]),
    bookId: uuidArrayQuerySchema.optional().default([]),
    includeDescendants: z.coerce.boolean().default(true),
    attributionMode: attributionModeSchema,
    includeUnattributed: z.coerce.boolean().default(false),
    currency: z.string().trim().min(1).max(16).optional(),
    status: statusArrayQuerySchema,
  })
  .superRefine((value, ctx) => {
    if (value.scopeType === "counterparty" && value.counterpartyId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["counterpartyId"],
        message: "counterpartyId[] is required for scopeType=counterparty",
      });
    }

    if (value.scopeType === "group" && value.groupId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["groupId"],
        message: "groupId[] is required for scopeType=group",
      });
    }

    if (value.scopeType === "book" && value.bookId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["bookId"],
        message: "bookId[] is required for scopeType=book",
      });
    }
  });

const periodRangeQuerySchema = z
  .object({
    from: dateTimeSchema,
    to: dateTimeSchema,
  })
  .superRefine((value, ctx) => {
    if (new Date(value.from) > new Date(value.to)) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "from must be earlier than or equal to to",
      });
    }
  });

const asOfQuerySchema = z.object({
  asOf: dateTimeSchema,
});

const paginationQuerySchema = PaginationInputSchema.pick({
  limit: true,
  offset: true,
});

export const TrialBalanceQuerySchema = PaginationInputSchema.extend({
  sortBy: z
    .enum([
      "accountNo",
      "accountName",
      "currency",
      "openingDebitMinor",
      "openingCreditMinor",
      "periodDebitMinor",
      "periodCreditMinor",
      "closingDebitMinor",
      "closingCreditMinor",
    ])
    .default("accountNo"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
})
  .merge(reportScopeQuerySchema)
  .merge(periodRangeQuerySchema);

export const GeneralLedgerQuerySchema = PaginationInputSchema.extend({
  accountNo: z.preprocess(toArray, z.array(z.string().trim().min(1)).default([])),
  sortBy: z.enum(["postingDate", "operationId", "lineNo"]).default("postingDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
})
  .merge(reportScopeQuerySchema)
  .merge(periodRangeQuerySchema)
  .superRefine((value, ctx) => {
    if (value.accountNo.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["accountNo"],
        message: "accountNo[] is required",
      });
    }
  });

export const BalanceSheetQuerySchema = reportScopeQuerySchema.merge(asOfQuerySchema);

export const IncomeStatementQuerySchema =
  reportScopeQuerySchema.merge(periodRangeQuerySchema);

export const CashFlowQuerySchema = reportScopeQuerySchema
  .merge(periodRangeQuerySchema)
  .extend({
    method: z.enum(["direct", "indirect"]).default("direct"),
  });

export const LiquidityQuerySchema = reportScopeQuerySchema
  .merge(paginationQuerySchema)
  .extend({
    asOf: dateTimeSchema.optional(),
  });

export const FxRevaluationQuerySchema =
  reportScopeQuerySchema.merge(periodRangeQuerySchema);

export const FeeRevenueQuerySchema = reportScopeQuerySchema
  .merge(periodRangeQuerySchema)
  .merge(paginationQuerySchema);

export const ClosePackageQuerySchema = z.object({
  counterpartyId: uuidSchema,
  periodStart: dateTimeSchema,
});

export type ReportScopeType = z.infer<typeof scopeTypeSchema>;
export type ReportAttributionMode = z.infer<typeof attributionModeSchema>;

export type TrialBalanceQuery = z.infer<typeof TrialBalanceQuerySchema>;
export type GeneralLedgerQuery = z.infer<typeof GeneralLedgerQuerySchema>;
export type BalanceSheetQuery = z.infer<typeof BalanceSheetQuerySchema>;
export type IncomeStatementQuery = z.infer<typeof IncomeStatementQuerySchema>;
export type CashFlowQuery = z.infer<typeof CashFlowQuerySchema>;
export type LiquidityQuery = z.infer<typeof LiquidityQuerySchema>;
export type FxRevaluationQuery = z.infer<typeof FxRevaluationQuerySchema>;
export type FeeRevenueQuery = z.infer<typeof FeeRevenueQuerySchema>;
export type ClosePackageQuery = z.infer<typeof ClosePackageQuerySchema>;
