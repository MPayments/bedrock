import { z } from "zod";

import { createPaginatedResponseSchema } from "@/lib/api/schemas";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

const CounterpartyAccountListItemSchema = z.object({
  id: z.uuid(),
  currencyId: z.uuid(),
  label: z.string(),
  accountNo: z.string().nullable(),
  iban: z.string().nullable(),
});

const CounterpartyAccountsResponseSchema = createPaginatedResponseSchema(
  CounterpartyAccountListItemSchema,
);

export type CounterpartyAccountOption = {
  id: string;
  label: string;
  currencyId: string;
};

export async function fetchCounterpartyAccountOptions(input: {
  counterpartyId: string;
  currencyLabelById: Map<string, string>;
}): Promise<CounterpartyAccountOption[]> {
  const query = new URLSearchParams({
    limit: "200",
    offset: "0",
    counterpartyId: input.counterpartyId,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const response = await fetch(`${API_URL}/v1/counterparty-accounts?${query.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить счета контрагента");
  }

  const payload = CounterpartyAccountsResponseSchema.parse(await response.json());

  return payload.data.map((item) => {
    const currencyLabel = input.currencyLabelById.get(item.currencyId) ?? "";
    const accountIdentity = item.accountNo ?? item.iban ?? item.id;

    return {
      id: item.id,
      currencyId: item.currencyId,
      label: `${item.label} · ${accountIdentity}${currencyLabel ? ` · ${currencyLabel}` : ""}`,
    };
  });
}
