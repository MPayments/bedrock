import { z } from "zod";

import {
  MAX_QUERY_LIST_LIMIT,
  createPaginatedListSchema,
} from "@bedrock/shared/core";

const RequisiteListItemSchema = z.object({
  id: z.uuid(),
  ownerType: z.enum(["organization", "counterparty"]),
  ownerId: z.uuid(),
  currencyId: z.uuid(),
  providerId: z.uuid(),
  label: z.string(),
  accountNo: z.string().nullish().transform((value) => value ?? null),
  iban: z.string().nullish().transform((value) => value ?? null),
  address: z.string().nullish().transform((value) => value ?? null),
  accountRef: z.string().nullish().transform((value) => value ?? null),
});

const RequisitesResponseSchema = createPaginatedListSchema(
  RequisiteListItemSchema,
);

export type RequisiteFetcher = typeof fetchRequisiteOptions;

export type RequisiteOption = {
  id: string;
  label: string;
  currencyId: string;
};

function buildRequisiteIdentity(
  item: z.infer<typeof RequisiteListItemSchema>,
): string | null {
  return item.accountNo ?? item.iban ?? item.accountRef ?? item.address ?? null;
}

export async function fetchRequisiteOptions(input: {
  ownerId: string;
  ownerType: "counterparty" | "organization";
  currencyId?: string;
  currencyLabelById: Map<string, string>;
}): Promise<RequisiteOption[]> {
  const query = new URLSearchParams({
    limit: String(MAX_QUERY_LIST_LIMIT),
    offset: "0",
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  if (input.currencyId) {
    query.set("currencyId", input.currencyId);
  }

  const response = await fetch(
    `/v1/requisites?${query.toString()}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Не удалось загрузить реквизиты");
  }

  const payload = RequisitesResponseSchema.parse(await response.json());

  return payload.data.map((item) => {
    const currencyLabel = input.currencyLabelById.get(item.currencyId) ?? "";
    const identity = buildRequisiteIdentity(item);
    const segments = [item.label];
    if (identity) segments.push(identity);
    if (currencyLabel) segments.push(currencyLabel);

    return {
      id: item.id,
      currencyId: item.currencyId,
      label: segments.join(" · "),
    };
  });
}
