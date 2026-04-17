"use client";

import {
  PaymentRouteCalculationSchema,
  PaymentRouteDraftSchema,
  PaymentRouteTemplateSchema,
  type CreatePaymentRouteTemplateInput,
  type PaymentRouteCalculation,
  type PaymentRouteDraft,
  type UpdatePaymentRouteTemplateInput,
} from "@bedrock/treasury/contracts";

import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";

async function readErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // Ignore invalid payloads and use the fallback below.
  }

  return fallbackMessage;
}

export function createPaymentRouteTemplate(input: CreatePaymentRouteTemplateInput) {
  return executeApiMutation({
    request: () =>
      fetch("/v1/payment-routes", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    schema: PaymentRouteTemplateSchema,
    fallbackMessage: "Не удалось создать маршрут",
  });
}

export function updatePaymentRouteTemplate(
  id: string,
  input: UpdatePaymentRouteTemplateInput,
) {
  return executeApiMutation({
    request: () =>
      fetch(`/v1/payment-routes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    schema: PaymentRouteTemplateSchema,
    fallbackMessage: "Не удалось сохранить маршрут",
  });
}

export function duplicatePaymentRouteTemplate(id: string) {
  return executeApiMutation({
    request: () =>
      fetch(`/v1/payment-routes/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }),
    schema: PaymentRouteTemplateSchema,
    fallbackMessage: "Не удалось продублировать маршрут",
  });
}

export function archivePaymentRouteTemplate(id: string) {
  return executeApiMutation({
    request: () =>
      fetch(`/v1/payment-routes/${encodeURIComponent(id)}/archive`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }),
    schema: PaymentRouteTemplateSchema,
    fallbackMessage: "Не удалось архивировать маршрут",
  });
}

export async function previewPaymentRoute(
  draft: PaymentRouteDraft,
  signal?: AbortSignal,
): Promise<PaymentRouteCalculation> {
  const payload = PaymentRouteDraftSchema.parse(draft);
  const response = await fetch("/v1/payment-routes/preview", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    signal,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ draft: payload }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Не удалось выполнить расчет маршрута"),
    );
  }

  return readJsonWithSchema(response, PaymentRouteCalculationSchema);
}
