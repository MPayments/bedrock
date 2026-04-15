import type { CreatePortalDealInput } from "@bedrock/deals/contracts";
import type {
  PortalDealListProjection,
  PortalDealProjection,
} from "@bedrock/workflow-deal-projections/contracts";

import { API_BASE_URL } from "@/lib/constants";

type SerializedDates<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? SerializedDates<U>[]
    : T extends object
      ? { [K in keyof T]: SerializedDates<T[K]> }
      : T;

type SerializedPortalDealProjection = SerializedDates<PortalDealProjection>;
type SerializedPortalDealListProjection =
  SerializedDates<PortalDealListProjection>;

function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  if ("error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if (
    "details" in payload &&
    payload.details &&
    typeof payload.details === "object"
  ) {
    const details = payload.details as {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };

    const formError = details.formErrors?.find(Boolean);
    if (formError) {
      return formError;
    }

    const fieldError = Object.values(details.fieldErrors ?? {})
      .flat()
      .find(Boolean);
    if (fieldError) {
      return fieldError;
    }
  }

  if (
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
  ) {
    if (
      "message" in payload.error &&
      typeof payload.error.message === "string"
    ) {
      return payload.error.message;
    }
  }

  return fallback;
}

export type PortalDealProjectionResponse = SerializedPortalDealProjection;
export type PortalDealListProjectionResponse = SerializedPortalDealListProjection;
export type PortalDealListItemProjection =
  SerializedPortalDealListProjection["data"][number];
export type PortalDealStatus = PortalDealProjectionResponse["summary"]["status"];
export type PortalDealType = PortalDealProjectionResponse["summary"]["type"];
export type PortalDealAttachment =
  PortalDealProjectionResponse["attachments"][number];
export type PortalDealCalculationSummary = NonNullable<
  PortalDealProjectionResponse["calculationSummary"]
>;
export type CreatePortalDealDraftInput = SerializedDates<CreatePortalDealInput>;

export async function requestPortalDealProjections(input?: {
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 20),
    offset: String(input?.offset ?? 0),
  });

  const response = await fetch(
    `${API_BASE_URL}/customer/deals/projections?${params.toString()}`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(`Ошибка загрузки сделок: ${response.status}`);
  }

  return (await response.json()) as PortalDealListProjectionResponse;
}

export async function requestPortalDealProjection(id: string) {
  const response = await fetch(
    `${API_BASE_URL}/customer/deals/${id}/projection`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Сделка не найдена");
    }

    throw new Error(`Ошибка загрузки сделки: ${response.status}`);
  }

  return (await response.json()) as PortalDealProjectionResponse;
}

export async function requestPortalDealAttachments(id: string) {
  const response = await fetch(
    `${API_BASE_URL}/customer/deals/${id}/attachments`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(`Ошибка загрузки вложений: ${response.status}`);
  }

  return (await response.json()) as PortalDealAttachment[];
}

export async function uploadPortalDealAttachment(input: {
  dealId: string;
  description?: string | null;
  file: File;
  purpose: "invoice" | "contract" | "other";
}) {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("purpose", input.purpose);
  if (input.description) {
    formData.set("description", input.description);
  }

  const response = await fetch(
    `${API_BASE_URL}/customer/deals/${input.dealId}/attachments`,
    {
      body: formData,
      credentials: "include",
      method: "POST",
    },
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorPayload?.error ?? "Не удалось загрузить вложение");
  }

  return (await response.json()) as PortalDealAttachment;
}

export function buildPortalDealAttachmentDownloadUrl(input: {
  attachmentId: string;
  dealId: string;
}) {
  return `${API_BASE_URL}/customer/deals/${input.dealId}/attachments/${input.attachmentId}/download`;
}

export async function deletePortalDealAttachment(input: {
  attachmentId: string;
  dealId: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/customer/deals/${input.dealId}/attachments/${input.attachmentId}`,
    {
      credentials: "include",
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(
      readApiErrorMessage(errorPayload, "Не удалось удалить вложение"),
    );
  }
}

export async function createPortalDealDraft(input: CreatePortalDealDraftInput) {
  const response = await fetch(`${API_BASE_URL}/customer/deals/drafts`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(
      readApiErrorMessage(errorPayload, "Не удалось создать сделку"),
    );
  }

  return (await response.json()) as PortalDealProjectionResponse;
}
