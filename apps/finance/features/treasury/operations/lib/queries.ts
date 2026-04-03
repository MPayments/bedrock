import { cache } from "react";

import type {
  TreasuryOperationWorkspaceDetail,
  TreasuryOperationWorkspaceListResponse,
} from "@bedrock/treasury/contracts";
import {
  TREASURY_OPERATIONS_LIST_CONTRACT,
  TreasuryOperationWorkspaceDetailSchema,
  TreasuryOperationWorkspaceListResponseSchema,
} from "@bedrock/treasury/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { readEntityById, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { TreasuryOperationsSearchParams } from "./validations";

function createTreasuryOperationsListQuery(
  search: TreasuryOperationsSearchParams,
) {
  return createResourceListQuery(TREASURY_OPERATIONS_LIST_CONTRACT, search);
}

export type TreasuryOperationsListResult = TreasuryOperationWorkspaceListResponse;
export type TreasuryOperationDetails = TreasuryOperationWorkspaceDetail;

export async function getTreasuryOperations(
  search: TreasuryOperationsSearchParams = {},
): Promise<TreasuryOperationsListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.treasury.operations.$get(
        {
          query: createTreasuryOperationsListQuery(search),
        },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryOperationWorkspaceListResponseSchema,
    context: "Не удалось загрузить операции казначейства",
  });

  return data;
}

const getTreasuryOperationByIdUncached = async (
  id: string,
): Promise<TreasuryOperationDetails | null> => {
  return readEntityById({
    id,
    resourceName: "операцию казначейства",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.treasury.operations[":operationId"].$get(
        {
          param: {
            operationId: validId,
          },
        },
        { init: { cache: "no-store" } },
      );
    },
    schema: TreasuryOperationWorkspaceDetailSchema,
  });
};

export const getTreasuryOperationById = cache(getTreasuryOperationByIdUncached);
