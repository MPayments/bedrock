import { z } from "zod";

import { executeApiMutation, type ApiMutationResult } from "@/lib/api/mutation";

const DocumentMutationSchema = z.object({
  id: z.uuid(),
  docType: z.string(),
  docNo: z.string(),
  submissionStatus: z.string().optional(),
  approvalStatus: z.string().optional(),
  postingStatus: z.string().optional(),
  lifecycleStatus: z.string().optional(),
  allowedActions: z
    .array(
      z.enum(["edit", "submit", "approve", "reject", "post", "cancel", "repost"]),
    )
    .optional(),
});

export type DocumentMutationDto = z.infer<typeof DocumentMutationSchema>;

function generateIdempotencyKey(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}`;
}

function buildDocumentUrl(path: string): string {
  return path;
}

function mutationHeaders(idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  return headers;
}

function parseDocumentResultSchema() {
  return DocumentMutationSchema;
}

export async function createDocumentDraft(input: {
  docType: string;
  payload: unknown;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  const createIdempotencyKey = generateIdempotencyKey("docs.create");

  return executeApiMutation({
    request: () =>
      fetch(buildDocumentUrl(`/v1/documents/${encodeURIComponent(input.docType)}`), {
        method: "POST",
        credentials: "include",
        headers: mutationHeaders(),
        body: JSON.stringify({
          createIdempotencyKey,
          input: input.payload,
        }),
      }),
    schema: parseDocumentResultSchema(),
    fallbackMessage: `Не удалось создать документ ${input.docType}`,
  });
}

export async function createDealScopedDocumentDraft(input: {
  dealId: string;
  docType: string;
  payload: unknown;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  const idempotencyKey = generateIdempotencyKey("deals.docs.create");

  return executeApiMutation({
    request: () =>
      fetch(
        buildDocumentUrl(
          `/v1/deals/${encodeURIComponent(input.dealId)}/formal-documents/${encodeURIComponent(input.docType)}`,
        ),
        {
          method: "POST",
          credentials: "include",
          headers: mutationHeaders(idempotencyKey),
          body: JSON.stringify({
            input: input.payload,
          }),
        },
      ),
    schema: parseDocumentResultSchema(),
    fallbackMessage: `Не удалось создать документ ${input.docType} для сделки`,
  });
}

export async function resolveDealReconciliationExceptionWithAdjustmentDocument(
  input: {
    dealId: string;
    docType: string;
    documentId: string;
    exceptionId: string;
  },
): Promise<ApiMutationResult<unknown>> {
  const idempotencyKey = generateIdempotencyKey(
    "deals.reconciliation.adjustment",
  );

  return executeApiMutation({
    request: () =>
      fetch(
        buildDocumentUrl(
          `/v1/deals/${encodeURIComponent(input.dealId)}/reconciliation/exceptions/${encodeURIComponent(input.exceptionId)}/adjustment-document`,
        ),
        {
          method: "POST",
          credentials: "include",
          headers: {
            ...mutationHeaders(idempotencyKey),
          },
          body: JSON.stringify({
            docType: input.docType,
            documentId: input.documentId,
          }),
        },
      ),
    schema: z.unknown(),
    fallbackMessage:
      "Не удалось разрешить исключение сверки корректировочным документом",
  });
}

export async function updateDocumentDraft(input: {
  docType: string;
  documentId: string;
  payload: unknown;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  const idempotencyKey = generateIdempotencyKey("docs.update");

  return executeApiMutation({
    request: () =>
      fetch(
        buildDocumentUrl(
          `/v1/documents/${encodeURIComponent(input.docType)}/${encodeURIComponent(input.documentId)}`,
        ),
        {
          method: "PATCH",
          credentials: "include",
          headers: mutationHeaders(idempotencyKey),
          body: JSON.stringify({ input: input.payload }),
        },
      ),
    schema: parseDocumentResultSchema(),
    fallbackMessage: `Не удалось обновить документ ${input.docType}`,
  });
}

async function mutateDocumentAction(input: {
  action: "submit" | "approve" | "reject" | "post" | "cancel" | "repost";
  docType: string;
  documentId: string;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  const idempotencyKey = generateIdempotencyKey(`docs.${input.action}`);

  return executeApiMutation({
    request: () =>
      fetch(
        buildDocumentUrl(
          `/v1/documents/${encodeURIComponent(input.docType)}/${encodeURIComponent(input.documentId)}/${input.action}`,
        ),
        {
          method: "POST",
          credentials: "include",
          headers: mutationHeaders(idempotencyKey),
        },
      ),
    schema: parseDocumentResultSchema(),
    fallbackMessage: `Не удалось выполнить действие ${input.action} для ${input.docType}`,
  });
}

export function submitDocument(input: {
  docType: string;
  documentId: string;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  return mutateDocumentAction({ ...input, action: "submit" });
}

export function approveDocument(input: {
  docType: string;
  documentId: string;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  return mutateDocumentAction({ ...input, action: "approve" });
}

export function rejectDocument(input: {
  docType: string;
  documentId: string;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  return mutateDocumentAction({ ...input, action: "reject" });
}

export function postDocument(input: {
  docType: string;
  documentId: string;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  return mutateDocumentAction({ ...input, action: "post" });
}

export function voidDocument(input: {
  docType: string;
  documentId: string;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  return mutateDocumentAction({ ...input, action: "cancel" });
}

export function repostDocument(input: {
  docType: string;
  documentId: string;
}): Promise<ApiMutationResult<DocumentMutationDto>> {
  return mutateDocumentAction({ ...input, action: "repost" });
}
