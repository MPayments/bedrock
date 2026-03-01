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
    amountMinor: z.string().nullable(),
    currency: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

const PaymentAttemptSchema = z
  .object({
    id: z.string(),
    attemptNo: z.number().int(),
    providerCode: z.string(),
    providerRoute: z.string().nullable(),
    status: z.string(),
    externalAttemptRef: z.string().nullable(),
    nextRetryAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

const PaymentEventSchema = z
  .object({
    id: z.string(),
    providerCode: z.string(),
    eventType: z.string(),
    signatureValid: z.boolean(),
    webhookIdempotencyKey: z.string(),
    status: z.string().nullable().optional(),
    parseStatus: z.string().nullable().optional(),
    error: z.string().nullable(),
    receivedAt: z.string(),
  })
  .passthrough();

const ConnectorIntentSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    direction: z.string(),
    amountMinor: z.string(),
    currency: z.string(),
    corridor: z.string().nullable(),
    providerConstraint: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

const PaymentListSchema = createPaginatedResponseSchema(PaymentDocumentSchema);

const PaymentDetailsSchema = z.object({
  document: PaymentDocumentSchema,
  details: z.unknown(),
  connectorIntent: ConnectorIntentSchema.nullable(),
  attempts: z.array(PaymentAttemptSchema),
  events: z.array(PaymentEventSchema),
});

export type PaymentDocumentDto = z.infer<typeof PaymentDocumentSchema>;
export type PaymentAttemptDto = z.infer<typeof PaymentAttemptSchema>;
export type PaymentEventDto = z.infer<typeof PaymentEventSchema>;
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
    await fetchApi(`/v1/payments?${params.toString()}`),
    "Не удалось загрузить платежи",
  );
  return readJsonWithSchema(response, PaymentListSchema);
}

const getPaymentDetailsUncached = async (id: string) => {
  const response = await fetchApi(`/v1/payments/${id}/details`);
  if (response.status === 404) {
    return null;
  }
  await requestOk(response, "Не удалось загрузить детали платежа");
  return readJsonWithSchema(response, PaymentDetailsSchema);
};

export const getPaymentDetails = cache(getPaymentDetailsUncached);
