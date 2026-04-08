import { z } from "zod";

import { apiClient } from "@/lib/api-client";
import { readJsonWithSchema } from "@/lib/api/response";

import type { CrmCustomerLegalEntityOption } from "@/app/(dashboard)/deals/_components/deal-intake-form";

const CounterpartyListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
    }),
  ),
});

const CounterpartyDetailSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  fullName: z.string(),
  legalEntity: z
    .object({
      identifiers: z.array(
        z.object({
          scheme: z.string(),
          value: z.string(),
        }),
      ),
    })
    .passthrough()
    .nullable(),
});

function findInn(counterparty: z.infer<typeof CounterpartyDetailSchema>) {
  return (
    counterparty.legalEntity?.identifiers.find(
      (identifier) => identifier.scheme === "inn",
    )?.value ?? null
  );
}

export async function loadCustomerOwnedCounterparties(
  customerId: string,
): Promise<CrmCustomerLegalEntityOption[]> {
  const response = await apiClient.v1.counterparties.$get({
    query: {
      customerId,
      limit: 100,
      offset: 0,
      relationshipKind: ["customer_owned"],
      sortBy: "createdAt",
      sortOrder: "desc",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить юридические лица клиента: ${response.status}`,
    );
  }

  const payload = await readJsonWithSchema(response, CounterpartyListResponseSchema);

  const counterparties = await Promise.all(
    payload.data.map(async ({ id }) => {
      const detailResponse = await apiClient.v1.counterparties[":id"].$get({
        param: { id },
      });

      if (!detailResponse.ok) {
        throw new Error(
          `Не удалось загрузить юридическое лицо ${id}: ${detailResponse.status}`,
        );
      }

      return readJsonWithSchema(detailResponse, CounterpartyDetailSchema);
    }),
  );

  return counterparties.map((counterparty) => ({
    counterpartyId: counterparty.id,
    fullName: counterparty.fullName,
    inn: findInn(counterparty),
    orgName: counterparty.shortName,
    shortName: counterparty.shortName,
  }));
}
