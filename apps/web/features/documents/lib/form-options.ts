import {
  CounterpartyOptionsResponseSchema,
} from "@multihansa/parties/counterparties/contracts";
import { CurrencyOptionsResponseSchema } from "@multihansa/assets/contracts";
import { OrganizationOptionsResponseSchema } from "@multihansa/parties/organizations/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { readOptionsList } from "@/lib/api/query";

export type DocumentFormCounterpartyOption = {
  id: string;
  label: string;
};

export type DocumentFormCurrencyOption = {
  id: string;
  code: string;
  label: string;
};

export type DocumentFormOptions = {
  counterparties: DocumentFormCounterpartyOption[];
  organizations: DocumentFormCounterpartyOption[];
  currencies: DocumentFormCurrencyOption[];
};

export function createEmptyDocumentFormOptions(): DocumentFormOptions {
  return {
    counterparties: [],
    organizations: [],
    currencies: [],
  };
}

export async function getDocumentFormOptions(): Promise<DocumentFormOptions> {
  const client = await getServerApiClient();

  const [counterparties, organizations, currencies] = await Promise.allSettled([
    readOptionsList({
      request: () =>
        client.v1.parties.counterparties.options.$get(
          {},
          { init: { cache: "force-cache" } },
        ),
      schema: CounterpartyOptionsResponseSchema,
      context: "Не удалось загрузить контрагентов",
    }),
    readOptionsList({
      request: () =>
        client.v1.parties.organizations.options.$get(
          {},
          { init: { cache: "force-cache" } },
        ),
      schema: OrganizationOptionsResponseSchema,
      context: "Не удалось загрузить организации",
    }),
    readOptionsList({
      request: () =>
        client.v1.currencies.options.$get(
          {},
          { init: { cache: "force-cache" } },
        ),
      schema: CurrencyOptionsResponseSchema,
      context: "Не удалось загрузить валюты",
    }),
  ]);

  const emptyOptions = createEmptyDocumentFormOptions();

  return {
    counterparties:
      counterparties.status === "fulfilled"
        ? counterparties.value.data.map((item) => ({
            id: item.id,
            label: item.label,
          }))
        : emptyOptions.counterparties,
    organizations:
      organizations.status === "fulfilled"
        ? organizations.value.data.map((item) => ({
            id: item.id,
            label: item.label,
          }))
        : emptyOptions.organizations,
    currencies:
      currencies.status === "fulfilled"
        ? currencies.value.data.map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
          }))
        : emptyOptions.currencies,
  };
}
