import { z } from "zod";

import {
  ReportDateTimeSchema,
  ReportScopeMetaSchema,
  ReportUuidSchema,
} from "./zod";
import { AccountingClosePackageStateSchema } from "../../../periods/application/contracts/zod";

export { ReportScopeMetaSchema } from "./zod";

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
  postingDate: ReportDateTimeSchema,
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
  documentId: ReportUuidSchema,
  docType: z.string(),
  docNo: z.string(),
  occurredAt: ReportDateTimeSchema,
  title: z.string(),
});

export const ClosePackageAuditEventSchema = z.object({
  id: ReportUuidSchema,
  eventType: z.string(),
  actorId: z.string().nullable(),
  createdAt: ReportDateTimeSchema,
});

export const ClosePackageResponseSchema = z.object({
  id: ReportUuidSchema,
  organizationId: ReportUuidSchema,
  periodStart: ReportDateTimeSchema,
  periodEnd: ReportDateTimeSchema,
  revision: z.number().int().positive(),
  state: AccountingClosePackageStateSchema,
  checksum: z.string(),
  generatedAt: ReportDateTimeSchema,
  closeDocumentId: ReportUuidSchema,
  reopenDocumentId: ReportUuidSchema.nullable(),
  trialBalanceSummaryByCurrency: z.array(TrialBalanceSummaryByCurrencySchema),
  incomeStatementSummaryByCurrency: z.array(IncomeStatementSummaryByCurrencySchema),
  cashFlowSummaryByCurrency: z.array(CashFlowSummaryByCurrencySchema),
  adjustments: z.array(ClosePackageAdjustmentSchema),
  auditEvents: z.array(ClosePackageAuditEventSchema),
  payload: z.record(z.string(), z.unknown()),
});
