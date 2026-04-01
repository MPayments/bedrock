import { API_BASE_URL } from "@/lib/constants";

export type PortalDealStatus =
  | "draft"
  | "submitted"
  | "rejected"
  | "preparing_documents"
  | "awaiting_funds"
  | "awaiting_payment"
  | "closing_documents"
  | "done"
  | "cancelled";

export type PortalDealType =
  | "payment"
  | "currency_exchange"
  | "currency_transit"
  | "exporter_settlement";

export interface PortalDealCalculationSummary {
  id: string;
}

export interface PortalDealAttachment {
  createdAt: string;
  fileName: string;
  id: string;
}

export interface PortalDealQuoteSummary {
  expiresAt: string | null;
  quoteId: string | null;
  status: string | null;
}

export interface PortalSubmissionCompleteness {
  blockingReasons: string[];
  complete: boolean;
}

export interface PortalDealListItemProjection {
  applicantDisplayName: string | null;
  attachmentCount: number;
  calculationSummary: PortalDealCalculationSummary | null;
  createdAt: string;
  id: string;
  nextAction: string;
  quoteExpiresAt: string | null;
  status: PortalDealStatus;
  submissionComplete: boolean;
  type: PortalDealType;
}

export interface PortalDealListProjectionResponse {
  data: PortalDealListItemProjection[];
  limit: number;
  offset: number;
  total: number;
}

export interface PortalDealTimelineEvent {
  actor: {
    label: string | null;
    userId: string | null;
  } | null;
  id: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  type:
    | "deal_created"
    | "intake_saved"
    | "participant_changed"
    | "status_changed"
    | "quote_created"
    | "quote_accepted"
    | "quote_expired"
    | "quote_used"
    | "calculation_attached"
    | "attachment_uploaded"
    | "attachment_deleted"
    | "document_created"
    | "document_status_changed";
  visibility: "customer_safe" | "internal";
}

export interface PortalDealProjectionResponse {
  attachments: PortalDealAttachment[];
  calculationSummary: PortalDealCalculationSummary | null;
  customerSafeIntake: {
    contractNumber: string | null;
    customerNote: string | null;
    expectedAmount: string | null;
    expectedCurrencyId: string | null;
    invoiceNumber: string | null;
    purpose: string | null;
    requestedExecutionDate: string | null;
    sourceAmount: string | null;
    sourceCurrencyId: string | null;
    targetCurrencyId: string | null;
  };
  nextAction: string;
  quoteSummary: PortalDealQuoteSummary | null;
  requiredActions: string[];
  submissionCompleteness: PortalSubmissionCompleteness;
  summary: {
    applicantDisplayName: string | null;
    createdAt: string;
    id: string;
    status: PortalDealStatus;
    type: PortalDealType;
  };
  timeline: PortalDealTimelineEvent[];
}

export interface CreatePortalDealDraftInput {
  common: {
    applicantCounterpartyId: string;
    customerNote: string | null;
    requestedExecutionDate: string | null;
  };
  incomingReceipt?: {
    contractNumber: string | null;
    expectedAmount: string | null;
    expectedAt: string | null;
    expectedCurrencyId: string | null;
    invoiceNumber: string | null;
  };
  moneyRequest: {
    purpose: string | null;
    sourceAmount: string | null;
    sourceCurrencyId: string | null;
    targetCurrencyId: string | null;
  };
  type: PortalDealType;
}

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
  const response = await fetch(`${API_BASE_URL}/customer/deals/${id}/projection`, {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Сделка не найдена");
    }

    throw new Error(`Ошибка загрузки сделки: ${response.status}`);
  }

  return (await response.json()) as PortalDealProjectionResponse;
}

export async function requestPortalDealAttachments(id: string) {
  const response = await fetch(`${API_BASE_URL}/customer/deals/${id}/attachments`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Ошибка загрузки вложений: ${response.status}`);
  }

  return (await response.json()) as PortalDealAttachment[];
}

export async function uploadPortalDealAttachment(input: {
  dealId: string;
  description?: string | null;
  file: File;
}) {
  const formData = new FormData();
  formData.set("file", input.file);
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
    const errorPayload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
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
    const errorPayload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(errorPayload?.error ?? "Не удалось удалить вложение");
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
    const errorPayload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(errorPayload?.error ?? "Не удалось создать сделку");
  }

  return (await response.json()) as PortalDealProjectionResponse;
}
