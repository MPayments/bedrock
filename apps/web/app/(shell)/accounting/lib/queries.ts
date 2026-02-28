import {
  AccountingCorrespondenceRuleSchema,
  AccountingTemplateAccountSchema,
} from "@bedrock/accounting/contracts";
import {
  CounterpartyGroupOptionsResponseSchema,
  CounterpartyOptionsResponseSchema,
} from "@bedrock/counterparties/contracts";
import {
  FinancialResultsByCounterpartyResponseSchema,
  FinancialResultsByGroupResponseSchema,
} from "@bedrock/accounting-reporting/contracts";
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
export type FinancialResultsByCounterpartyDto = z.infer<
  typeof FinancialResultsByCounterpartyResponseSchema
>;
export type FinancialResultsByGroupDto = z.infer<
  typeof FinancialResultsByGroupResponseSchema
>;
export type FinancialResultSummaryByCurrencyDto = z.infer<
  typeof FinancialResultsByCounterpartyResponseSchema.shape.summaryByCurrency.element
>;

export async function getAccountingOrgOptions(): Promise<AccountingOrgOption[]> {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.counterparties.options.$get(
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

  return readJsonWithSchema(response, z.array(AccountingTemplateAccountResponseSchema));
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

  return readJsonWithSchema(response, AccountingCorrespondenceRulesResponseSchema);
}

export async function getFinancialResultsByCounterparty(
  query: Record<string, string | string[]>,
): Promise<FinancialResultsByCounterpartyDto> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.accounting["financial-results"].counterparties.$get(
      {
        query,
      },
      {
        init: { cache: "no-store" },
      },
    ),
    "Не удалось загрузить финансовый результат по контрагентам",
  );

  return readJsonWithSchema(response, FinancialResultsByCounterpartyResponseSchema);
}

export async function getFinancialResultsByGroup(
  query: Record<string, string | string[]>,
): Promise<FinancialResultsByGroupDto> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.accounting["financial-results"].groups.$get(
      {
        query,
      },
      {
        init: { cache: "no-store" },
      },
    ),
    "Не удалось загрузить финансовый результат по группам",
  );

  return readJsonWithSchema(response, FinancialResultsByGroupResponseSchema);
}
