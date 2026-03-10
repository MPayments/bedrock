import {
  CounterpartyOptionsResponseSchema,
} from "@multihansa/parties/counterparties/contracts";
import { CurrencyOptionsResponseSchema } from "@bedrock/finance/assets/contracts";
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

export async function getDocumentFormOptions(): Promise<DocumentFormOptions> {
  const client = await getServerApiClient();

  const [counterparties, organizations, currencies] = await Promise.all([
    readOptionsList({
      request: () =>
        client.v1.parties.counterparties.options.$get({}, { init: { cache: "force-cache" } }),
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
        client.v1.currencies.options.$get({}, { init: { cache: "force-cache" } }),
      schema: CurrencyOptionsResponseSchema,
      context: "Не удалось загрузить валюты",
    }),
  ]);

  return {
    counterparties: counterparties.data.map((item) => ({
      id: item.id,
      label: item.label,
    })),
    organizations: organizations.data.map((item) => ({
      id: item.id,
      label: item.label,
    })),
    currencies: currencies.data.map((item) => ({
      id: item.id,
      code: item.code,
      label: item.label,
    })),
  };
}
