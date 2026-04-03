import type { ListQueryContract } from "@bedrock/shared/core/pagination";

import { createResourceSearchParamsCache } from "@/lib/resources/search-params";
import type { ResourceSearchParams } from "@/lib/resources/search-params";

import {
  FINANCE_DEAL_BLOCKER_STATE_VALUES,
  FINANCE_DEAL_QUEUE_VALUES,
  FINANCE_DEAL_STAGE_VALUES,
  FINANCE_DEAL_STATUS_VALUES,
  FINANCE_DEAL_TYPE_VALUES,
} from "../labels";

const FINANCE_DEALS_SORTABLE_COLUMNS = [
  "applicantName",
  "internalEntityName",
  "queue",
  "type",
  "status",
  "createdAt",
] as const;

interface FinanceDealsListFilters {
  applicant: { kind: "string"; cardinality: "single" };
  blockerState: {
    kind: "string";
    cardinality: "single";
    enumValues: typeof FINANCE_DEAL_BLOCKER_STATE_VALUES;
  };
  internalEntity: { kind: "string"; cardinality: "single" };
  queue: {
    kind: "string";
    cardinality: "single";
    enumValues: typeof FINANCE_DEAL_QUEUE_VALUES;
  };
  stage: {
    kind: "string";
    cardinality: "single";
    enumValues: typeof FINANCE_DEAL_STAGE_VALUES;
  };
  status: {
    kind: "string";
    cardinality: "single";
    enumValues: typeof FINANCE_DEAL_STATUS_VALUES;
  };
  type: {
    kind: "string";
    cardinality: "single";
    enumValues: typeof FINANCE_DEAL_TYPE_VALUES;
  };
}

export const FINANCE_DEALS_LIST_CONTRACT: ListQueryContract<
  typeof FINANCE_DEALS_SORTABLE_COLUMNS,
  FinanceDealsListFilters
> = {
  sortableColumns: FINANCE_DEALS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    applicant: { kind: "string", cardinality: "single" },
    blockerState: {
      kind: "string",
      cardinality: "single",
      enumValues: FINANCE_DEAL_BLOCKER_STATE_VALUES,
    },
    internalEntity: { kind: "string", cardinality: "single" },
    queue: {
      kind: "string",
      cardinality: "single",
      enumValues: FINANCE_DEAL_QUEUE_VALUES,
    },
    stage: {
      kind: "string",
      cardinality: "single",
      enumValues: FINANCE_DEAL_STAGE_VALUES,
    },
    status: {
      kind: "string",
      cardinality: "single",
      enumValues: FINANCE_DEAL_STATUS_VALUES,
    },
    type: {
      kind: "string",
      cardinality: "single",
      enumValues: FINANCE_DEAL_TYPE_VALUES,
    },
  },
};

export const searchParamsCache = createResourceSearchParamsCache(
  FINANCE_DEALS_LIST_CONTRACT,
);

export type FinanceDealsSearchParams = ResourceSearchParams & {
  applicant?: string | null;
  blockerState?: string | null;
  createdAt?: string | null;
  internalEntity?: string | null;
  queue?: string | null;
  stage?: string | null;
  status?: string | null;
  type?: string | null;
};

export type FinanceDealsSortId =
  (typeof FINANCE_DEALS_SORTABLE_COLUMNS)[number];
