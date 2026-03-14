import { z } from "zod";

import { PaginationInputSchema } from "@bedrock/shared/core/pagination";

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
  organizationId: uuidSchema,
  periodStart: dateTimeSchema,
});

export const ReportScopeMetaSchema = z.object({
  scopeType: z.enum(["all", "counterparty", "group", "book"]),
  requestedCounterpartyIds: z.array(z.uuid()),
  requestedGroupIds: z.array(z.uuid()),
  requestedBookIds: z.array(z.uuid()),
  resolvedCounterpartyIdsCount: z.number().int().nonnegative(),
  attributionMode: z.enum(["analytic_counterparty", "book_org"]),
  hasUnattributedData: z.boolean(),
});

export const TrialBalanceRowSchema = z.object({
  accountNo: z.string(),
  accountName: z.string().nullable(),
  accountKind: z.string().nullable(),
  currency: z.string(),
  openingDebit: z.string(),
  openingCredit: z.string(),
  periodDebit: z.string(),
  periodCredit: z.string(),
  closingDebit: z.string(),
  closingCredit: z.string(),
});

export const TrialBalanceSummaryByCurrencySchema = z.object({
  currency: z.string(),
  openingDebit: z.string(),
  openingCredit: z.string(),
  periodDebit: z.string(),
  periodCredit: z.string(),
  closingDebit: z.string(),
  closingCredit: z.string(),
});

export const TrialBalanceResponseSchema = z.object({
  data: z.array(TrialBalanceRowSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  summaryByCurrency: z.array(TrialBalanceSummaryByCurrencySchema),
  scopeMeta: ReportScopeMetaSchema,
});

export const GeneralLedgerEntrySchema = z.object({
  operationId: z.uuid(),
  lineNo: z.number().int().nonnegative(),
  postingDate: z.iso.datetime(),
  bookId: z.uuid(),
  bookLabel: z.string(),
  accountNo: z.string(),
  currency: z.string(),
  postingCode: z.string(),
  counterpartyId: z.uuid().nullable(),
  debit: z.string(),
  credit: z.string(),
  runningBalance: z.string(),
});

export const GeneralLedgerBalanceSchema = z.object({
  accountNo: z.string(),
  currency: z.string(),
  balance: z.string(),
});

export const GeneralLedgerResponseSchema = z.object({
  data: z.array(GeneralLedgerEntrySchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  openingBalances: z.array(GeneralLedgerBalanceSchema),
  closingBalances: z.array(GeneralLedgerBalanceSchema),
  scopeMeta: ReportScopeMetaSchema,
});

export const BalanceSheetRowSchema = z.object({
  section: z.string(),
  lineCode: z.string(),
  lineLabel: z.string(),
  currency: z.string(),
  amount: z.string(),
});

export const BalanceSheetCheckSchema = z.object({
  currency: z.string(),
  assets: z.string(),
  liabilities: z.string(),
  equity: z.string(),
  imbalance: z.string(),
});

export const BalanceSheetResponseSchema = z.object({
  data: z.array(BalanceSheetRowSchema),
  checks: z.array(BalanceSheetCheckSchema),
  scopeMeta: ReportScopeMetaSchema,
});

export const IncomeStatementRowSchema = z.object({
  section: z.string(),
  lineCode: z.string(),
  lineLabel: z.string(),
  currency: z.string(),
  amount: z.string(),
});

export const IncomeStatementSummaryByCurrencySchema = z.object({
  currency: z.string(),
  revenue: z.string(),
  expense: z.string(),
  net: z.string(),
});

export const IncomeStatementResponseSchema = z.object({
  data: z.array(IncomeStatementRowSchema),
  summaryByCurrency: z.array(IncomeStatementSummaryByCurrencySchema),
  scopeMeta: ReportScopeMetaSchema,
});

export const CashFlowRowSchema = z.object({
  section: z.string(),
  lineCode: z.string(),
  lineLabel: z.string(),
  currency: z.string(),
  amount: z.string(),
});

export const CashFlowSummaryByCurrencySchema = z.object({
  currency: z.string(),
  netCashFlow: z.string(),
});

export const CashFlowResponseSchema = z.object({
  method: z.enum(["direct", "indirect"]),
  data: z.array(CashFlowRowSchema),
  summaryByCurrency: z.array(CashFlowSummaryByCurrencySchema),
  scopeMeta: ReportScopeMetaSchema,
});

export const LiquidityRowSchema = z.object({
  bookId: z.uuid(),
  bookLabel: z.string(),
  counterpartyId: z.uuid().nullable(),
  counterpartyName: z.string().nullable(),
  currency: z.string(),
  ledgerBalance: z.string(),
  available: z.string(),
  reserved: z.string(),
  pending: z.string(),
});

export const LiquidityResponseSchema = z.object({
  data: z.array(LiquidityRowSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  scopeMeta: ReportScopeMetaSchema,
});

export const FxRevaluationRowSchema = z.object({
  bucket: z.enum(["realized", "unrealized"]),
  currency: z.string(),
  revenue: z.string(),
  expense: z.string(),
  net: z.string(),
});

export const FxRevaluationSummaryByCurrencySchema = z.object({
  currency: z.string(),
  realizedNet: z.string(),
  unrealizedNet: z.string(),
  totalNet: z.string(),
});

export const FxRevaluationResponseSchema = z.object({
  data: z.array(FxRevaluationRowSchema),
  summaryByCurrency: z.array(FxRevaluationSummaryByCurrencySchema),
  scopeMeta: ReportScopeMetaSchema,
});

export const FeeRevenueRowSchema = z.object({
  product: z.string(),
  channel: z.string(),
  counterpartyId: z.uuid().nullable(),
  counterpartyName: z.string().nullable(),
  currency: z.string(),
  feeRevenue: z.string(),
  spreadRevenue: z.string(),
  providerFeeExpense: z.string(),
  net: z.string(),
});

export const FeeRevenueSummaryByCurrencySchema = z.object({
  currency: z.string(),
  feeRevenue: z.string(),
  spreadRevenue: z.string(),
  providerFeeExpense: z.string(),
  net: z.string(),
});

export const FeeRevenueResponseSchema = z.object({
  data: z.array(FeeRevenueRowSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  summaryByCurrency: z.array(FeeRevenueSummaryByCurrencySchema),
  scopeMeta: ReportScopeMetaSchema,
});

export const ClosePackageAdjustmentSchema = z.object({
  documentId: z.uuid(),
  docType: z.string(),
  docNo: z.string(),
  occurredAt: z.iso.datetime(),
  title: z.string(),
});

export const ClosePackageAuditEventSchema = z.object({
  id: z.uuid(),
  eventType: z.string(),
  actorId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const ClosePackageResponseSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  revision: z.number().int().positive(),
  state: z.enum(["closed", "superseded"]),
  checksum: z.string(),
  generatedAt: z.iso.datetime(),
  closeDocumentId: z.uuid(),
  reopenDocumentId: z.uuid().nullable(),
  trialBalanceSummaryByCurrency: z.array(TrialBalanceSummaryByCurrencySchema),
  incomeStatementSummaryByCurrency: z.array(IncomeStatementSummaryByCurrencySchema),
  cashFlowSummaryByCurrency: z.array(CashFlowSummaryByCurrencySchema),
  adjustments: z.array(ClosePackageAdjustmentSchema),
  auditEvents: z.array(ClosePackageAuditEventSchema),
  payload: z.record(z.string(), z.unknown()),
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
