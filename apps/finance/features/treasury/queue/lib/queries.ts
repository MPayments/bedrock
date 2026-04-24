import { cache } from "react";
import { z } from "zod";

import {
  TreasuryExceptionQueueRowSchema,
  type TreasuryExceptionQueueRow,
  type TreasuryExceptionQueueRowKind,
} from "@bedrock/deals/contracts";

import { getServerApiClient } from "@/lib/api/server-client";

const TreasuryExceptionQueueResponseSchema = z.object({
  data: z.array(TreasuryExceptionQueueRowSchema),
});

export type TreasuryExceptionQueueFilters = {
  currencyCode?: string;
  dealId?: string;
  internalEntityOrganizationId?: string;
  kind?: TreasuryExceptionQueueRowKind;
  limit?: number;
};

const getTreasuryExceptionQueueUncached = async (
  filters: TreasuryExceptionQueueFilters = {},
): Promise<TreasuryExceptionQueueRow[]> => {
  const client = await getServerApiClient();
  const response = await client.v1.treasury.queue.$get(
    {
      query: {
        currencyCode: filters.currencyCode,
        dealId: filters.dealId,
        internalEntityOrganizationId: filters.internalEntityOrganizationId,
        kind: filters.kind,
        limit: filters.limit ? String(filters.limit) : undefined,
      },
    },
    { init: { cache: "no-store" } },
  );

  if (!response.ok) {
    throw new Error(`Failed to load exception queue: ${response.status}`);
  }

  const body = await response.json();
  const parsed = TreasuryExceptionQueueResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Invalid exception queue response");
  }

  return parsed.data.data;
};

export const getTreasuryExceptionQueue = cache(
  getTreasuryExceptionQueueUncached,
);
