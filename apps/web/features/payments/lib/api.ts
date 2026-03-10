import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

const PaymentDocumentSchema = z
  .object({
    id: z.string(),
    docType: z.string(),
    docNo: z.string(),
    title: z.string(),
    submissionStatus: z.string(),
    approvalStatus: z.string(),
    postingStatus: z.string(),
    lifecycleStatus: z.string(),
    amount: z.string().nullable(),
    currency: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

const PaymentListSchema = createPaginatedResponseSchema(PaymentDocumentSchema);

const PaymentDetailsSchema = z.object({
  document: PaymentDocumentSchema,
  details: z.unknown(),
});

export type PaymentDocumentDto = z.infer<typeof PaymentDocumentSchema>;
export type PaymentDetailsDto = z.infer<typeof PaymentDetailsSchema>;

async function fetchApi(path: string) {
  const requestHeaders = await headers();
  return fetch(`${API_URL}${path}`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    cache: "no-store",
  });
}

export async function listPayments(input?: {
  kind?: "intent" | "resolution" | "all";
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  params.set("kind", input?.kind ?? "intent");
  params.set("limit", String(input?.limit ?? 50));
  params.set("offset", String(input?.offset ?? 0));

  const response = await requestOk(
    await fetchApi(`/v1/treasury/payments?${params.toString()}`),
    "Не удалось загрузить платежи",
  );
  return readJsonWithSchema(response, PaymentListSchema);
}

const getPaymentDetailsUncached = async (id: string) => {
  const response = await fetchApi(`/v1/treasury/payments/${id}/details`);
  if (response.status === 404) {
    return null;
  }
  await requestOk(response, "Не удалось загрузить детали платежа");
  return readJsonWithSchema(response, PaymentDetailsSchema);
};

export const getPaymentDetails = cache(getPaymentDetailsUncached);
