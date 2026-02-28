import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { DOCUMENTS_LIST_CONTRACT } from "@bedrock/documents/contracts";

import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import {
  readJsonWithSchema,
  requestOk,
} from "@/lib/api/response";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { OperationsSearchParams } from "./validations";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export const DocumentSchema = z.object({
  id: z.uuid(),
  docType: z.string(),
  docNo: z.string(),
  payloadVersion: z.number().int(),
  payload: z.record(z.string(), z.unknown()),
  title: z.string(),
  occurredAt: z.iso.datetime(),
  submissionStatus: z.enum(["draft", "submitted"]),
  approvalStatus: z.enum(["not_required", "pending", "approved", "rejected"]),
  postingStatus: z.enum([
    "not_required",
    "unposted",
    "posting",
    "posted",
    "failed",
  ]),
  lifecycleStatus: z.enum(["active", "cancelled", "voided", "archived"]),
  createIdempotencyKey: z.string().nullable(),
  amountMinor: z.string().nullable(),
  currency: z.string().nullable(),
  memo: z.string().nullable(),
  counterpartyId: z.string().nullable(),
  customerId: z.string().nullable(),
  operationalAccountId: z.string().nullable(),
  searchText: z.string(),
  createdBy: z.string(),
  submittedBy: z.string().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  rejectedBy: z.string().nullable(),
  rejectedAt: z.iso.datetime().nullable(),
  cancelledBy: z.string().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  postingStartedAt: z.iso.datetime().nullable(),
  postedAt: z.iso.datetime().nullable(),
  postingError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int(),
  postingOperationId: z.string().nullable(),
});

const DocumentLinkSchema = z.object({
  id: z.uuid(),
  fromDocumentId: z.uuid(),
  toDocumentId: z.uuid(),
  linkType: z.enum(["parent", "depends_on", "compensates", "related"]),
  role: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

const DocumentOperationSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  operationId: z.uuid(),
  kind: z.string(),
  createdAt: z.iso.datetime(),
});

const DocumentsListResponseSchema = createPaginatedResponseSchema(DocumentSchema);

const DocumentDetailsSchema = z.object({
  document: DocumentSchema,
  links: z.array(DocumentLinkSchema),
  parent: DocumentSchema.nullable(),
  children: z.array(DocumentSchema),
  dependsOn: z.array(DocumentSchema),
  compensates: z.array(DocumentSchema),
  documentOperations: z.array(DocumentOperationSchema),
  ledgerOperations: z.array(z.unknown()),
  computed: z.unknown().optional(),
  extra: z.unknown().optional(),
});

export type DocumentDto = z.infer<typeof DocumentSchema>;
export type DocumentLinkDto = z.infer<typeof DocumentLinkSchema>;
export type DocumentOperationDto = z.infer<typeof DocumentOperationSchema>;
export type DocumentDetailsDto = z.infer<typeof DocumentDetailsSchema>;

async function fetchApi(path: string) {
  const requestHeaders = await headers();

  return fetch(`${API_URL}${path}`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    cache: "no-store",
  });
}

function createDocumentsListQuery(search: OperationsSearchParams) {
  return createResourceListQuery(DOCUMENTS_LIST_CONTRACT, search);
}

export async function getDocuments(
  search: OperationsSearchParams,
): Promise<z.infer<typeof DocumentsListResponseSchema>> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(createDocumentsListQuery(search))) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, String(item));
      }
      continue;
    }

    query.set(key, String(value));
  }

  const response = await requestOk(
    await fetchApi(`/v1/docs?${query.toString()}`),
    "Не удалось загрузить документы",
  );

  return readJsonWithSchema(response, DocumentsListResponseSchema);
}

const getDocumentUncached = async (
  docType: string,
  id: string,
): Promise<DocumentDto | null> => {
  const response = await fetchApi(`/v1/docs/${docType}/${id}`);

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить документ");
  return readJsonWithSchema(response, DocumentSchema);
};

const getDocumentDetailsUncached = async (
  docType: string,
  id: string,
): Promise<DocumentDetailsDto | null> => {
  const response = await fetchApi(`/v1/docs/${docType}/${id}/details`);

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить детали документа");
  return readJsonWithSchema(response, DocumentDetailsSchema);
};

export const getDocument = cache(getDocumentUncached);
export const getDocumentDetails = cache(getDocumentDetailsUncached);
