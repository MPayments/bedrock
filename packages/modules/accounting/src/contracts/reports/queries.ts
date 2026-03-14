import { z } from "zod";

import { PaginationInputSchema } from "@bedrock/shared/core/pagination";

import {
  ReportAsOfQuerySchema,
  ReportDateTimeSchema,
  ReportPaginationQuerySchema,
  ReportPeriodRangeQuerySchema,
  ReportScopeQuerySchema,
  ReportUuidSchema,
} from "./zod";
import type {
  ReportAttributionMode,
  ReportScopeType,
} from "../../domain/reports";

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
  .merge(ReportScopeQuerySchema)
  .merge(ReportPeriodRangeQuerySchema);

export const GeneralLedgerQuerySchema = PaginationInputSchema.extend({
  accountNo: z.preprocess(toAccountNoArray, z.array(z.string().trim().min(1)).default([])),
  sortBy: z.enum(["postingDate", "operationId", "lineNo"]).default("postingDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
})
  .merge(ReportScopeQuerySchema)
  .merge(ReportPeriodRangeQuerySchema)
  .superRefine((value, ctx) => {
    if (value.accountNo.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["accountNo"],
        message: "accountNo[] is required",
      });
    }
  });

export const BalanceSheetQuerySchema =
  ReportScopeQuerySchema.merge(ReportAsOfQuerySchema);

export const IncomeStatementQuerySchema =
  ReportScopeQuerySchema.merge(ReportPeriodRangeQuerySchema);

export const CashFlowQuerySchema = ReportScopeQuerySchema
  .merge(ReportPeriodRangeQuerySchema)
  .extend({
    method: z.enum(["direct", "indirect"]).default("direct"),
  });

export const LiquidityQuerySchema = ReportScopeQuerySchema
  .merge(ReportPaginationQuerySchema)
  .extend({
    asOf: ReportDateTimeSchema.optional(),
  });

export const FxRevaluationQuerySchema =
  ReportScopeQuerySchema.merge(ReportPeriodRangeQuerySchema);

export const FeeRevenueQuerySchema = ReportScopeQuerySchema
  .merge(ReportPeriodRangeQuerySchema)
  .merge(ReportPaginationQuerySchema);

export const ClosePackageQuerySchema = z.object({
  organizationId: ReportUuidSchema,
  periodStart: ReportDateTimeSchema,
});

export type TrialBalanceQuery = z.infer<typeof TrialBalanceQuerySchema>;
export type GeneralLedgerQuery = z.infer<typeof GeneralLedgerQuerySchema>;
export type BalanceSheetQuery = z.infer<typeof BalanceSheetQuerySchema>;
export type IncomeStatementQuery = z.infer<typeof IncomeStatementQuerySchema>;
export type CashFlowQuery = z.infer<typeof CashFlowQuerySchema>;
export type LiquidityQuery = z.infer<typeof LiquidityQuerySchema>;
export type FxRevaluationQuery = z.infer<typeof FxRevaluationQuerySchema>;
export type FeeRevenueQuery = z.infer<typeof FeeRevenueQuerySchema>;
export type ClosePackageQuery = z.infer<typeof ClosePackageQuerySchema>;

export type { ReportAttributionMode, ReportScopeType };

function toAccountNoArray(value: unknown): unknown[] | undefined {
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
