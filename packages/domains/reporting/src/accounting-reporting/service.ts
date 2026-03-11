import { defineService } from "@bedrock/core";
import { z } from "zod";

import { mapBalanceSheetDto } from "@multihansa/accounting";
import { mapCashFlowDto } from "@multihansa/accounting";
import { mapClosePackageDto } from "@multihansa/accounting";
import { mapFeeRevenueDto } from "@multihansa/accounting";
import { mapFxRevaluationDto } from "@multihansa/accounting";
import { mapGeneralLedgerDto } from "@multihansa/accounting";
import { mapIncomeStatementDto } from "@multihansa/accounting";
import { mapLiquidityDto } from "@multihansa/accounting";
import { mapTrialBalanceDto } from "@multihansa/accounting";
import {
  BalanceSheetQuerySchema,
  BalanceSheetResponseSchema,
  CashFlowQuerySchema,
  CashFlowResponseSchema,
  ClosePackageQuerySchema,
  ClosePackageResponseSchema,
  FeeRevenueQuerySchema,
  FeeRevenueResponseSchema,
  FxRevaluationQuerySchema,
  FxRevaluationResponseSchema,
  GeneralLedgerQuerySchema,
  GeneralLedgerResponseSchema,
  IncomeStatementQuerySchema,
  IncomeStatementResponseSchema,
  LiquidityQuerySchema,
  LiquidityResponseSchema,
  TrialBalanceQuerySchema,
  TrialBalanceResponseSchema,
} from "@multihansa/reporting/accounting-reporting";

import { AccountingReportingDomainServiceToken } from "../tokens";

const CsvExportSchema = z.object({
  filename: z.string().min(1),
  headers: z.array(z.string().min(1)),
  rows: z.array(z.record(z.string(), z.unknown())),
});

type ClosePackageCsvRow = {
  counterpartyId: string;
  periodStart: string;
  periodEnd: string;
  revision: number;
  state: "closed" | "superseded";
  currency: string;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
  revenue: string;
  expense: string;
  net: string;
  netCashFlow: string;
  adjustmentDocumentIds: string;
  adjustmentDocNos: string;
  closeDocumentId: string;
  reopenDocumentId: string;
};

function createClosePackageCsvRows(input: ReturnType<typeof mapClosePackageDto>): ClosePackageCsvRow[] {
  const trialBalanceByCurrency = new Map(
    input.trialBalanceSummaryByCurrency.map((row) => [row.currency, row] as const),
  );
  const incomeByCurrency = new Map(
    input.incomeStatementSummaryByCurrency.map((row) => [row.currency, row] as const),
  );
  const cashFlowByCurrency = new Map(
    input.cashFlowSummaryByCurrency.map((row) => [row.currency, row] as const),
  );
  const currencies = [
    ...new Set([
      ...trialBalanceByCurrency.keys(),
      ...incomeByCurrency.keys(),
      ...cashFlowByCurrency.keys(),
    ]),
  ];
  const adjustmentDocumentIds = input.adjustments.map((row) => row.documentId).join("|");
  const adjustmentDocNos = input.adjustments.map((row) => row.docNo).join("|");

  return currencies.map((currency) => {
    const trialBalance = trialBalanceByCurrency.get(currency);
    const income = incomeByCurrency.get(currency);
    const cashFlow = cashFlowByCurrency.get(currency);

    return {
      counterpartyId: input.counterpartyId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      revision: input.revision,
      state: input.state,
      currency,
      openingDebit: trialBalance?.openingDebit ?? "",
      openingCredit: trialBalance?.openingCredit ?? "",
      periodDebit: trialBalance?.periodDebit ?? "",
      periodCredit: trialBalance?.periodCredit ?? "",
      closingDebit: trialBalance?.closingDebit ?? "",
      closingCredit: trialBalance?.closingCredit ?? "",
      revenue: income?.revenue ?? "",
      expense: income?.expense ?? "",
      net: income?.net ?? "",
      netCashFlow: cashFlow?.netCashFlow ?? "",
      adjustmentDocumentIds,
      adjustmentDocNos,
      closeDocumentId: input.closeDocumentId,
      reopenDocumentId: input.reopenDocumentId ?? "",
    };
  });
}

type PaginatedPayload<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};

async function readAllPages<T>(
  firstPage: PaginatedPayload<T>,
  loadPage: (input: {
    limit: number;
    offset: number;
  }) => Promise<PaginatedPayload<T>>,
): Promise<T[]> {
  const rows: T[] = [...firstPage.data];
  let offset = firstPage.offset + firstPage.data.length;
  const pageSize = firstPage.limit;

  while (rows.length < firstPage.total) {
    const page = await loadPage({ limit: pageSize, offset });
    if (page.data.length === 0) {
      break;
    }

    rows.push(...page.data);
    offset += page.data.length;
  }

  return rows;
}

export const accountingReportsService = defineService("accounting-reports", {
  deps: {
    reporting: AccountingReportingDomainServiceToken,
  },
  ctx: ({ reporting }) => ({
    reporting,
  }),
  actions: ({ action }) => ({
    listTrialBalance: action({
      input: TrialBalanceQuerySchema,
      output: TrialBalanceResponseSchema,
      handler: async ({ ctx, input }) =>
        mapTrialBalanceDto(await ctx.reporting.listTrialBalance(input)),
    }),
    exportTrialBalance: action({
      input: TrialBalanceQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => {
        const firstPage = await ctx.reporting.listTrialBalance({
          ...input,
          limit: 200,
          offset: 0,
        });
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          ctx.reporting.listTrialBalance({
            ...input,
            limit,
            offset,
          }),
        );

        return {
          filename: "trial-balance.csv",
          headers: [
            "accountNo",
            "accountName",
            "accountKind",
            "currency",
            "openingDebit",
            "openingCredit",
            "periodDebit",
            "periodCredit",
            "closingDebit",
            "closingCredit",
          ],
          rows: mapTrialBalanceDto({
            ...firstPage,
            data: rows,
          }).data,
        };
      },
    }),
    listGeneralLedger: action({
      input: GeneralLedgerQuerySchema,
      output: GeneralLedgerResponseSchema,
      handler: async ({ ctx, input }) =>
        mapGeneralLedgerDto(await ctx.reporting.listGeneralLedger(input)),
    }),
    exportGeneralLedger: action({
      input: GeneralLedgerQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => {
        const firstPage = await ctx.reporting.listGeneralLedger({
          ...input,
          limit: 200,
          offset: 0,
        });
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          ctx.reporting.listGeneralLedger({
            ...input,
            limit,
            offset,
          }),
        );

        return {
          filename: "general-ledger.csv",
          headers: [
            "operationId",
            "lineNo",
            "postingDate",
            "bookId",
            "bookLabel",
            "accountNo",
            "currency",
            "postingCode",
            "counterpartyId",
            "debit",
            "credit",
            "runningBalance",
          ],
          rows: mapGeneralLedgerDto({
            ...firstPage,
            data: rows,
          }).data,
        };
      },
    }),
    listBalanceSheet: action({
      input: BalanceSheetQuerySchema,
      output: BalanceSheetResponseSchema,
      handler: async ({ ctx, input }) =>
        mapBalanceSheetDto(await ctx.reporting.listBalanceSheet(input)),
    }),
    exportBalanceSheet: action({
      input: BalanceSheetQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => ({
        filename: "balance-sheet.csv",
        headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
        rows: mapBalanceSheetDto(await ctx.reporting.listBalanceSheet(input)).data,
      }),
    }),
    listIncomeStatement: action({
      input: IncomeStatementQuerySchema,
      output: IncomeStatementResponseSchema,
      handler: async ({ ctx, input }) =>
        mapIncomeStatementDto(await ctx.reporting.listIncomeStatement(input)),
    }),
    exportIncomeStatement: action({
      input: IncomeStatementQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => ({
        filename: "income-statement.csv",
        headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
        rows: mapIncomeStatementDto(await ctx.reporting.listIncomeStatement(input)).data,
      }),
    }),
    listCashFlow: action({
      input: CashFlowQuerySchema,
      output: CashFlowResponseSchema,
      handler: async ({ ctx, input }) =>
        mapCashFlowDto(await ctx.reporting.listCashFlow(input)),
    }),
    exportCashFlow: action({
      input: CashFlowQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => ({
        filename: "cash-flow.csv",
        headers: ["section", "lineCode", "lineLabel", "currency", "amount"],
        rows: mapCashFlowDto(await ctx.reporting.listCashFlow(input)).data,
      }),
    }),
    listLiquidity: action({
      input: LiquidityQuerySchema,
      output: LiquidityResponseSchema,
      handler: async ({ ctx, input }) =>
        mapLiquidityDto(await ctx.reporting.listLiquidity(input)),
    }),
    exportLiquidity: action({
      input: LiquidityQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => {
        const firstPage = await ctx.reporting.listLiquidity({
          ...input,
          limit: 200,
          offset: 0,
        });
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          ctx.reporting.listLiquidity({
            ...input,
            limit,
            offset,
          }),
        );

        return {
          filename: "liquidity.csv",
          headers: [
            "bookId",
            "bookLabel",
            "counterpartyId",
            "counterpartyName",
            "currency",
            "ledgerBalance",
            "available",
            "reserved",
            "pending",
          ],
          rows: mapLiquidityDto({
            ...firstPage,
            data: rows,
          }).data,
        };
      },
    }),
    listFxRevaluation: action({
      input: FxRevaluationQuerySchema,
      output: FxRevaluationResponseSchema,
      handler: async ({ ctx, input }) =>
        mapFxRevaluationDto(await ctx.reporting.listFxRevaluation(input)),
    }),
    exportFxRevaluation: action({
      input: FxRevaluationQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => ({
        filename: "fx-revaluation.csv",
        headers: ["bucket", "currency", "revenue", "expense", "net"],
        rows: mapFxRevaluationDto(await ctx.reporting.listFxRevaluation(input)).data,
      }),
    }),
    listFeeRevenue: action({
      input: FeeRevenueQuerySchema,
      output: FeeRevenueResponseSchema,
      handler: async ({ ctx, input }) =>
        mapFeeRevenueDto(await ctx.reporting.listFeeRevenue(input)),
    }),
    exportFeeRevenue: action({
      input: FeeRevenueQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => {
        const firstPage = await ctx.reporting.listFeeRevenue({
          ...input,
          limit: 200,
          offset: 0,
        });
        const rows = await readAllPages(firstPage, ({ limit, offset }) =>
          ctx.reporting.listFeeRevenue({
            ...input,
            limit,
            offset,
          }),
        );

        return {
          filename: "fee-revenue.csv",
          headers: [
            "product",
            "channel",
            "counterpartyId",
            "counterpartyName",
            "currency",
            "feeRevenue",
            "spreadRevenue",
            "providerFeeExpense",
            "net",
          ],
          rows: mapFeeRevenueDto({
            ...firstPage,
            data: rows,
          }).data,
        };
      },
    }),
    getClosePackage: action({
      input: ClosePackageQuerySchema,
      output: ClosePackageResponseSchema,
      handler: async ({ ctx, input }) =>
        mapClosePackageDto(await ctx.reporting.listClosePackage(input)),
    }),
    exportClosePackage: action({
      input: ClosePackageQuerySchema,
      output: CsvExportSchema,
      handler: async ({ ctx, input }) => {
        const payload = mapClosePackageDto(
          await ctx.reporting.listClosePackage(input),
        );
        return {
          filename: "close-package.csv",
          headers: [
            "counterpartyId",
            "periodStart",
            "periodEnd",
            "revision",
            "state",
            "currency",
            "openingDebit",
            "openingCredit",
            "periodDebit",
            "periodCredit",
            "closingDebit",
            "closingCredit",
            "revenue",
            "expense",
            "net",
            "netCashFlow",
            "adjustmentDocumentIds",
            "adjustmentDocNos",
            "closeDocumentId",
            "reopenDocumentId",
          ],
          rows: createClosePackageCsvRows(payload),
        };
      },
    }),
  }),
});
