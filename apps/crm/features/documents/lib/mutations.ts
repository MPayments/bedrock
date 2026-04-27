import {
  DocumentMutationSchema,
  type DocumentMutationDto,
  type DocumentMutationResult,
} from "@bedrock/sdk-documents-form-ui/lib/mutations";

import { executeApiMutation } from "@/lib/api/mutation";
import { API_BASE_URL } from "@/lib/constants";

function generateIdempotencyKey(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}`;
}

function commonHeaders(idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return headers;
}

async function parseDocument(response: {
  json: () => Promise<unknown>;
}): Promise<DocumentMutationDto> {
  const data = await response.json();
  return DocumentMutationSchema.parse(data);
}

function toResult(
  result: Awaited<ReturnType<typeof executeApiMutation<DocumentMutationDto>>>,
): DocumentMutationResult {
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, data: result.data };
}

export async function createDealScopedDocumentDraft(input: {
  dealId: string;
  docType: string;
  payload: unknown;
}): Promise<DocumentMutationResult> {
  const idempotencyKey = generateIdempotencyKey("create-deal-doc");
  const result = await executeApiMutation<DocumentMutationDto>({
    fallbackMessage: "Не удалось создать документ",
    parseData: parseDocument,
    request: () =>
      fetch(
        `${API_BASE_URL}/deals/${encodeURIComponent(input.dealId)}/formal-documents/${encodeURIComponent(input.docType)}`,
        {
          body: JSON.stringify({
            input: input.payload,
          }),
          credentials: "include",
          headers: commonHeaders(idempotencyKey),
          method: "POST",
        },
      ),
  });
  return toResult(result);
}

export async function createDocumentDraft(input: {
  docType: string;
  payload: unknown;
}): Promise<DocumentMutationResult> {
  const idempotencyKey = generateIdempotencyKey("create-doc");
  const result = await executeApiMutation<DocumentMutationDto>({
    fallbackMessage: "Не удалось создать документ",
    parseData: parseDocument,
    request: () =>
      fetch(
        `${API_BASE_URL}/documents/${encodeURIComponent(input.docType)}`,
        {
          body: JSON.stringify({
            input: input.payload,
          }),
          credentials: "include",
          headers: commonHeaders(idempotencyKey),
          method: "POST",
        },
      ),
  });
  return toResult(result);
}

export async function updateDocumentDraft(input: {
  docType: string;
  documentId: string;
  payload: unknown;
}): Promise<DocumentMutationResult> {
  const result = await executeApiMutation<DocumentMutationDto>({
    fallbackMessage: "Не удалось обновить черновик",
    parseData: parseDocument,
    request: () =>
      fetch(
        `${API_BASE_URL}/documents/${encodeURIComponent(input.docType)}/${encodeURIComponent(input.documentId)}`,
        {
          body: JSON.stringify({ input: input.payload }),
          credentials: "include",
          headers: commonHeaders(),
          method: "PUT",
        },
      ),
  });
  return toResult(result);
}

async function transitionDocument(input: {
  docType: string;
  documentId: string;
  action: "submit" | "approve" | "reject" | "post" | "cancel" | "repost";
  fallbackMessage: string;
}): Promise<DocumentMutationResult> {
  const idempotencyKey = generateIdempotencyKey(input.action);
  const result = await executeApiMutation<DocumentMutationDto>({
    fallbackMessage: input.fallbackMessage,
    parseData: parseDocument,
    request: () =>
      fetch(
        `${API_BASE_URL}/documents/${encodeURIComponent(input.docType)}/${encodeURIComponent(input.documentId)}/${input.action}`,
        {
          body: JSON.stringify({}),
          credentials: "include",
          headers: commonHeaders(idempotencyKey),
          method: "POST",
        },
      ),
  });
  return toResult(result);
}

export async function submitDocument(input: {
  docType: string;
  documentId: string;
}): Promise<DocumentMutationResult> {
  return transitionDocument({
    ...input,
    action: "submit",
    fallbackMessage: "Не удалось отправить документ",
  });
}

export async function postDocument(input: {
  docType: string;
  documentId: string;
}): Promise<DocumentMutationResult> {
  return transitionDocument({
    ...input,
    action: "post",
    fallbackMessage: "Не удалось провести документ",
  });
}

export async function cancelDocument(input: {
  docType: string;
  documentId: string;
}): Promise<DocumentMutationResult> {
  return transitionDocument({
    ...input,
    action: "cancel",
    fallbackMessage: "Не удалось отменить документ",
  });
}
