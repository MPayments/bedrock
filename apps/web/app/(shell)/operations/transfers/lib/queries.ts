import { cache } from "react";

import { TRANSFERS_LIST_CONTRACT } from "@bedrock/transfers/validation";

import { getServerApiClient } from "@/lib/api-client.server";
import { readResourceById } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { TransfersSearchParams } from "./validations";

export interface TransferDto {
  id: string;
  sourceCounterpartyId: string;
  destinationCounterpartyId: string;
  sourceOperationalAccountId: string;
  destinationOperationalAccountId: string;
  currencyId: string;
  currencyCode: string | null;
  sourceCounterpartyName: string | null;
  destinationCounterpartyName: string | null;
  sourceOperationalAccountLabel: string | null;
  destinationOperationalAccountLabel: string | null;
  amountMinor: string;
  kind: "intra_org" | "cross_org";
  settlementMode: "immediate" | "pending";
  timeoutSeconds: number;
  status:
    | "draft"
    | "approved_pending_posting"
    | "pending"
    | "settle_pending_posting"
    | "void_pending_posting"
    | "posted"
    | "voided"
    | "rejected"
    | "failed";
  memo: string | null;
  makerUserId: string;
  checkerUserId: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  ledgerOperationId: string | null;
  sourcePendingTransferId: string | null;
  destinationPendingTransferId: string | null;
  idempotencyKey: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransfersListResult {
  data: TransferDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransferFormOptions {
  accounts: {
    id: string;
    label: string;
    counterpartyId: string;
    currencyId: string;
  }[];
  counterparties: {
    id: string;
    shortName: string;
  }[];
  currencies: {
    id: string;
    code: string;
    name: string;
    precision: number;
  }[];
}

function createTransfersListQuery(search: TransfersSearchParams) {
  return createResourceListQuery(TRANSFERS_LIST_CONTRACT, search);
}

export async function getTransfers(
  search: TransfersSearchParams,
): Promise<TransfersListResult> {
  const client = await getServerApiClient();
  const res = await client.v1.transfers.$get({
    query: createTransfersListQuery(search),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch transfers: ${res.status}`);
  }

  return res.json() as Promise<TransfersListResult>;
}

const getTransferByIdUncached = async (
  id: string,
): Promise<TransferDto | null> => {
  return readResourceById<TransferDto>({
    id,
    resourceName: "transfer",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.transfers[":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
  });
};

export const getTransferById = cache(getTransferByIdUncached);

export async function getTransferFormOptions(): Promise<TransferFormOptions> {
  const client = await getServerApiClient();

  const [accountsRes, counterpartiesRes, currenciesRes] = await Promise.all([
    client.v1.accounts.$get(
      { query: { limit: 100, offset: 0 } as Record<string, unknown> },
      { init: { cache: "no-store" } },
    ),
    client.v1.counterparties.$get(
      { query: { limit: 100, offset: 0 } as Record<string, unknown> },
      { init: { cache: "no-store" } },
    ),
    client.v1.currencies.$get(
      { query: { limit: 100, offset: 0 } as Record<string, unknown> },
      { init: { cache: "no-store" } },
    ),
  ]);

  if (!accountsRes.ok) {
    throw new Error(`Failed to fetch accounts: ${accountsRes.status}`);
  }
  if (!counterpartiesRes.ok) {
    throw new Error(
      `Failed to fetch counterparties: ${counterpartiesRes.status}`,
    );
  }
  if (!currenciesRes.ok) {
    throw new Error(`Failed to fetch currencies: ${currenciesRes.status}`);
  }

  const accountsPayload = (await accountsRes.json()) as {
    data: {
      id: string;
      label: string;
      counterpartyId: string;
      currencyId: string;
    }[];
  };
  const counterpartiesPayload = (await counterpartiesRes.json()) as {
    data: {
      id: string;
      shortName: string;
    }[];
  };
  const currenciesPayload = (await currenciesRes.json()) as {
    data: {
      id: string;
      code: string;
      name: string;
      precision: number;
    }[];
  };

  return {
    accounts: accountsPayload.data,
    counterparties: counterpartiesPayload.data,
    currencies: currenciesPayload.data,
  };
}
