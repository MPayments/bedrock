import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import {
  paginateInMemory,
  sortInMemory,
  type SortInput,
} from "@bedrock/shared/core/pagination";

import { readJsonWithSchema, requestOk } from "@/lib/api/response";
import type { EntityListResult } from "@/components/entities/entity-table-shell";
import {
  FINANCE_DEAL_QUEUE_VALUES,
  FINANCE_DEAL_STATUS_VALUES,
  FINANCE_DEAL_TYPE_VALUES,
  getFinanceDealQueueLabel,
  getFinanceDealStatusLabel,
  getFinanceDealTypeLabel,
  type FinanceDealQueue,
  type FinanceDealStatus,
  type FinanceDealType,
} from "../labels";

import type { FinanceDealsSearchParams, FinanceDealsSortId } from "./validations";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const FinanceDealQueueSchema = z.enum(FINANCE_DEAL_QUEUE_VALUES);
const FinanceDealStatusSchema = z.enum(FINANCE_DEAL_STATUS_VALUES);
const FinanceDealTypeSchema = z.enum(FINANCE_DEAL_TYPE_VALUES);
const DealIdSchema = z.uuid({ version: "v4" });

const FinanceDealQueueFiltersSchema = z.object({
  applicant: z.string().trim().min(1).optional(),
  internalEntity: z.string().trim().min(1).optional(),
  queue: FinanceDealQueueSchema.optional(),
  status: FinanceDealStatusSchema.optional(),
  type: FinanceDealTypeSchema.optional(),
});

const FinanceDealListItemSchema = z.object({
  applicantName: z.string().nullable(),
  blockingReasons: z.array(z.string()),
  createdAt: z.iso.datetime(),
  dealId: z.string().uuid(),
  documentSummary: z.object({
    attachmentCount: z.number().int().nonnegative(),
    formalDocumentCount: z.number().int().nonnegative(),
  }),
  executionSummary: z.object({
    blockedLegCount: z.number().int().nonnegative(),
    doneLegCount: z.number().int().nonnegative(),
    totalLegCount: z.number().int().nonnegative(),
  }),
  internalEntityName: z.string().nullable(),
  nextAction: z.string(),
  profitabilitySnapshot: z
    .object({
      calculationId: z.string().uuid(),
      currencyId: z.string().uuid(),
      feeRevenueMinor: z.string(),
      spreadRevenueMinor: z.string(),
      totalRevenueMinor: z.string(),
    })
    .nullable(),
  queue: FinanceDealQueueSchema,
  queueReason: z.string(),
  quoteSummary: z
    .object({
      expiresAt: z.iso.datetime().nullable(),
      quoteId: z.string().uuid().nullable(),
      status: z.string().nullable(),
    })
    .nullable(),
  status: FinanceDealStatusSchema,
  type: FinanceDealTypeSchema,
});

const FinanceDealsResponseSchema = z.object({
  counts: z.object({
    execution: z.number().int().nonnegative(),
    failed_instruction: z.number().int().nonnegative(),
    funding: z.number().int().nonnegative(),
  }),
  filters: FinanceDealQueueFiltersSchema,
  items: z.array(FinanceDealListItemSchema),
});

const FinanceDealWorkspaceSchema = z.object({
  acceptedQuote: z
    .object({
      acceptedAt: z.iso.datetime(),
      expiresAt: z.iso.datetime().nullable(),
      quoteId: z.string().uuid(),
      quoteStatus: z.string(),
      usedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  executionPlan: z.array(
    z.object({
      idx: z.number().int().positive(),
      kind: z.string(),
      state: z.string(),
    }),
  ),
  operationalState: z.object({
    capabilities: z.array(
      z.object({
        kind: z.string(),
        note: z.string().nullable(),
        reasonCode: z.string().nullable(),
        status: z.string(),
      }),
    ),
    positions: z.array(
      z.object({
        amountMinor: z.string().nullable(),
        kind: z.string(),
        reasonCode: z.string().nullable(),
        state: z.string(),
      }),
    ),
  }),
  profitabilitySnapshot: z
    .object({
      calculationId: z.string().uuid(),
      feeRevenueMinor: z.string(),
      spreadRevenueMinor: z.string(),
      totalRevenueMinor: z.string(),
    })
    .nullable(),
  queueContext: z.object({
    blockers: z.array(z.string()),
    queue: FinanceDealQueueSchema,
    queueReason: z.string(),
  }),
  relatedResources: z.object({
    attachments: z.array(
      z.object({
        id: z.string().uuid(),
      }),
    ),
    formalDocuments: z.array(
      z.object({
        docType: z.string(),
        id: z.string().uuid(),
      }),
    ),
    quotes: z.array(
      z.object({
        id: z.string().uuid(),
        status: z.string(),
      }),
    ),
  }),
  summary: z.object({
    applicantDisplayName: z.string().nullable(),
    createdAt: z.iso.datetime(),
    id: z.string().uuid(),
    internalEntityDisplayName: z.string().nullable(),
    status: FinanceDealStatusSchema,
    type: FinanceDealTypeSchema,
    updatedAt: z.iso.datetime(),
  }),
  timeline: z.array(
    z.object({
      actor: z
        .object({
          label: z.string().nullable(),
        })
        .nullable(),
      id: z.string().uuid(),
      occurredAt: z.iso.datetime(),
      type: z.string(),
    }),
  ),
});

type FinanceDealFilters = z.infer<typeof FinanceDealQueueFiltersSchema>;

async function fetchApi(path: string) {
  const requestHeaders = await headers();

  return fetch(`${API_URL}${path}`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
      "x-bedrock-app-audience": "finance",
    },
    cache: "no-store",
  });
}

function getStringValue(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveSort(search: FinanceDealsSearchParams): {
  sortBy?: FinanceDealsSortId;
  sortOrder?: SortInput["sortOrder"];
} {
  const firstSort = search.sort?.[0];

  if (!firstSort) {
    return {
      sortBy: "createdAt",
      sortOrder: "desc",
    };
  }

  return {
    sortBy: firstSort.id as FinanceDealsSortId,
    sortOrder: firstSort.desc ? "desc" : "asc",
  };
}

function resolvePagination(search: FinanceDealsSearchParams) {
  const limit = typeof search.perPage === "number" ? search.perPage : 10;
  const page = typeof search.page === "number" ? search.page : 1;
  const offset = Math.max(0, (page - 1) * limit);

  return {
    limit,
    offset,
  };
}

function createFinanceDealFilters(
  search: FinanceDealsSearchParams,
): FinanceDealFilters {
  const queue = getStringValue(search.queue);
  const status = getStringValue(search.status);
  const type = getStringValue(search.type);

  return {
    applicant: getStringValue(search.applicant),
    internalEntity: getStringValue(search.internalEntity),
    queue: FINANCE_DEAL_QUEUE_VALUES.includes(queue as FinanceDealQueue)
      ? (queue as FinanceDealQueue)
      : undefined,
    status: FINANCE_DEAL_STATUS_VALUES.includes(status as FinanceDealStatus)
      ? (status as FinanceDealStatus)
      : undefined,
    type: FINANCE_DEAL_TYPE_VALUES.includes(type as FinanceDealType)
      ? (type as FinanceDealType)
      : undefined,
  };
}

function createFinanceDealsPath(filters: FinanceDealFilters) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      query.set(key, value);
    }
  }

  return `/v1/deals/finance/queues?${query.toString()}`;
}

const FINANCE_DEAL_SORT_MAP: Record<
  FinanceDealsSortId,
  (item: FinanceDealListItem) => string
> = {
  applicantName: (item) => item.applicantName ?? "",
  createdAt: (item) => item.createdAt,
  internalEntityName: (item) => item.internalEntityName ?? "",
  queue: (item) => getFinanceDealQueueLabel(item.queue),
  status: (item) => getFinanceDealStatusLabel(item.status),
  type: (item) => getFinanceDealTypeLabel(item.type),
};

export type FinanceDealListItem = z.infer<typeof FinanceDealListItemSchema>;
export type FinanceDealsListResult = EntityListResult<FinanceDealListItem>;
export type FinanceDealWorkspace = z.infer<typeof FinanceDealWorkspaceSchema>;

export async function getFinanceDeals(
  search: FinanceDealsSearchParams = {},
): Promise<FinanceDealsListResult> {
  const filters = createFinanceDealFilters(search);
  const response = await requestOk(
    await fetchApi(createFinanceDealsPath(filters)),
    "Не удалось загрузить сделки казначейства",
  );
  const payload = await readJsonWithSchema(response, FinanceDealsResponseSchema);
  const { sortBy, sortOrder } = resolveSort(search);
  const sortedItems = sortInMemory(payload.items, {
    sortBy,
    sortOrder,
    sortMap: FINANCE_DEAL_SORT_MAP,
  });

  return paginateInMemory(sortedItems, resolvePagination(search));
}

const getFinanceDealWorkspaceByIdUncached = async (
  id: string,
): Promise<FinanceDealWorkspace | null> => {
  if (!DealIdSchema.safeParse(id).success) {
    return null;
  }

  const response = await fetchApi(
    `/v1/deals/${encodeURIComponent(id)}/finance-workspace`,
  );

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить рабочий стол сделки");
  return readJsonWithSchema(response, FinanceDealWorkspaceSchema);
};

export const getFinanceDealWorkspaceById = cache(
  getFinanceDealWorkspaceByIdUncached,
);
