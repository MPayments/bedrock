import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const FinanceDealQueueSchema = z.enum([
  "funding",
  "execution",
  "failed_instruction",
]);

const FinanceDealQueueFiltersSchema = z.object({
  applicant: z.string().trim().min(1).optional(),
  internalEntity: z.string().trim().min(1).optional(),
  queue: FinanceDealQueueSchema.optional(),
  status: z
    .enum([
      "draft",
      "submitted",
      "rejected",
      "preparing_documents",
      "awaiting_funds",
      "awaiting_payment",
      "closing_documents",
      "done",
      "cancelled",
    ])
    .optional(),
  type: z
    .enum([
      "payment",
      "currency_exchange",
      "currency_transit",
      "exporter_settlement",
    ])
    .optional(),
});

const FinanceDealQueueProjectionSchema = z.object({
  counts: z.object({
    execution: z.number().int(),
    failed_instruction: z.number().int(),
    funding: z.number().int(),
  }),
  filters: FinanceDealQueueFiltersSchema,
  items: z.array(
    z.object({
      applicantName: z.string().nullable(),
      blockingReasons: z.array(z.string()),
      dealId: z.string().uuid(),
      documentSummary: z.object({
        attachmentCount: z.number().int(),
        formalDocumentCount: z.number().int(),
      }),
      executionSummary: z.object({
        blockedLegCount: z.number().int(),
        doneLegCount: z.number().int(),
        totalLegCount: z.number().int(),
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
          expiresAt: z.string().nullable(),
          quoteId: z.string().uuid().nullable(),
          status: z.string().nullable(),
        })
        .nullable(),
      status: z.string(),
      type: z.string(),
    }),
  ),
});

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

export type FinanceDealQueueFilters = z.infer<
  typeof FinanceDealQueueFiltersSchema
>;
export type FinanceDealQueueProjection = z.infer<
  typeof FinanceDealQueueProjectionSchema
>;

const getFinanceDealQueuesUncached = async (
  filters: FinanceDealQueueFilters,
): Promise<FinanceDealQueueProjection> => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (!value) {
      continue;
    }

    query.set(key, value);
  }

  const response = await fetchApi(`/v1/deals/finance/queues?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Не удалось загрузить deal queues");
  }

  return FinanceDealQueueProjectionSchema.parse(await response.json());
};

export const getFinanceDealQueues = cache(getFinanceDealQueuesUncached);
