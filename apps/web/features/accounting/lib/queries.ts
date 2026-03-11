import {
  AccountingCorrespondenceRuleSchema,
  AccountingTemplateAccountSchema,
} from "@multihansa/accounting/contracts";
import {
  CounterpartyGroupOptionsResponseSchema,
  CounterpartyOptionsResponseSchema,
} from "@multihansa/parties/counterparties/contracts";
import {
  BalanceSheetResponseSchema,
  CashFlowResponseSchema,
  ClosePackageResponseSchema,
  FeeRevenueResponseSchema,
  FxRevaluationResponseSchema,
  GeneralLedgerResponseSchema,
  IncomeStatementResponseSchema,
  LiquidityResponseSchema,
  TrialBalanceResponseSchema,
} from "@multihansa/reporting/accounting-reporting/contracts";
import { z } from "zod";

import { getServerApiClient } from "@/lib/api/server-client";
import { readOptionsList } from "@/lib/api/query";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";

const AccountingTemplateAccountResponseSchema = AccountingTemplateAccountSchema;
const AccountingCorrespondenceRulesResponseSchema = z.array(
  AccountingCorrespondenceRuleSchema,
);

export type AccountingTemplateAccount = z.infer<
  typeof AccountingTemplateAccountResponseSchema
>;
export type AccountingCorrespondenceRule = z.infer<
  typeof AccountingCorrespondenceRuleSchema
>;
export type AccountingOrgOption = z.infer<
  typeof CounterpartyOptionsResponseSchema.shape.data.element
>;
export type CounterpartyGroupOption = z.infer<
  typeof CounterpartyGroupOptionsResponseSchema.shape.data.element
>;
export type TrialBalanceDto = z.infer<typeof TrialBalanceResponseSchema>;
export type GeneralLedgerDto = z.infer<typeof GeneralLedgerResponseSchema>;
export type BalanceSheetDto = z.infer<typeof BalanceSheetResponseSchema>;
export type IncomeStatementDto = z.infer<typeof IncomeStatementResponseSchema>;
export type CashFlowDto = z.infer<typeof CashFlowResponseSchema>;
export type LiquidityDto = z.infer<typeof LiquidityResponseSchema>;
export type FxRevaluationDto = z.infer<typeof FxRevaluationResponseSchema>;
export type FeeRevenueDto = z.infer<typeof FeeRevenueResponseSchema>;
export type ClosePackageDto = z.infer<typeof ClosePackageResponseSchema>;

export type AccountingReportKey =
  | "trial-balance"
  | "general-ledger"
  | "balance-sheet"
  | "income-statement"
  | "cash-flow"
  | "liquidity"
  | "fx-revaluation"
  | "fee-revenue"
  | "close-package";

type RouteQuery<T> = T extends (arg: infer TArg, ...rest: unknown[]) => unknown
  ? TArg extends { query: infer TQuery }
    ? TQuery
    : never
  : never;

export async function getAccountingOrgOptions(): Promise<
  AccountingOrgOption[]
> {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.parties.counterparties.options.$get(
        {},
        { init: { cache: "force-cache" } },
      ),
    schema: CounterpartyOptionsResponseSchema,
    context: "Не удалось загрузить организации",
  });

  return payload.data;
}

export async function getCounterpartyGroupOptions(): Promise<
  CounterpartyGroupOption[]
> {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1["counterparty-groups"].options.$get(
        {},
        { init: { cache: "force-cache" } },
      ),
    schema: CounterpartyGroupOptionsResponseSchema,
    context: "Не удалось загрузить группы контрагентов",
  });

  return payload.data;
}

export async function getAccountingTemplateAccounts(): Promise<
  AccountingTemplateAccount[]
> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.accounting.template.accounts.$get(
      {},
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить план счетов",
  );

  return readJsonWithSchema(
    response,
    z.array(AccountingTemplateAccountResponseSchema),
  );
}

export async function getAccountingCorrespondenceRules(): Promise<
  AccountingCorrespondenceRule[]
> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.accounting["correspondence-rules"].$get(
      {},
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить правила корреспонденции",
  );

  return readJsonWithSchema(
    response,
    AccountingCorrespondenceRulesResponseSchema,
  );
}

export async function getTrialBalance(
  query: Record<string, string | string[]>,
): Promise<TrialBalanceDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports)["trial-balance"]["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports["trial-balance"].$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить оборотно-сальдовую ведомость",
  );

  return readJsonWithSchema(response, TrialBalanceResponseSchema);
}

export async function getGeneralLedger(
  query: Record<string, string | string[]>,
): Promise<GeneralLedgerDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports)["general-ledger"]["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports["general-ledger"].$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить general ledger",
  );

  return readJsonWithSchema(response, GeneralLedgerResponseSchema);
}

export async function getBalanceSheet(
  query: Record<string, string | string[]>,
): Promise<BalanceSheetDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports)["balance-sheet"]["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports["balance-sheet"].$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить balance sheet",
  );

  return readJsonWithSchema(response, BalanceSheetResponseSchema);
}

export async function getIncomeStatement(
  query: Record<string, string | string[]>,
): Promise<IncomeStatementDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports)["income-statement"]["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports["income-statement"].$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить income statement",
  );

  return readJsonWithSchema(response, IncomeStatementResponseSchema);
}

export async function getCashFlow(
  query: Record<string, string | string[]>,
): Promise<CashFlowDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports)["cash-flow"]["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports["cash-flow"].$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить cash flow",
  );

  return readJsonWithSchema(response, CashFlowResponseSchema);
}

export async function getLiquidity(
  query: Record<string, string | string[]>,
): Promise<LiquidityDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports.liquidity)["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports.liquidity.$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить liquidity report",
  );

  return readJsonWithSchema(response, LiquidityResponseSchema);
}

export async function getFxRevaluation(
  query: Record<string, string | string[]>,
): Promise<FxRevaluationDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports.treasury)["fx-revaluation"]["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports.treasury["fx-revaluation"].$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить FX revaluation",
  );

  return readJsonWithSchema(response, FxRevaluationResponseSchema);
}

export async function getFeeRevenue(
  query: Record<string, string | string[]>,
): Promise<FeeRevenueDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports)["fee-revenue"]["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports["fee-revenue"].$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить fee revenue report",
  );

  return readJsonWithSchema(response, FeeRevenueResponseSchema);
}

export async function getClosePackage(
  query: Record<string, string | string[]>,
): Promise<ClosePackageDto> {
  const client = await getServerApiClient();
  type QueryInput = RouteQuery<
    (typeof client.v1.accounting.reports)["close-package"]["$get"]
  >;
  const response = await requestOk(
    await client.v1.accounting.reports["close-package"].$get(
      { query: query as QueryInput },
      { init: { cache: "no-store" } },
    ),
    "Не удалось загрузить close package",
  );

  return readJsonWithSchema(response, ClosePackageResponseSchema);
}
