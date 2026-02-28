import { cache } from "react";
import { headers } from "next/headers";

import { DOCUMENTS_LIST_CONTRACT } from "@bedrock/documents/contracts";

import { createResourceListQuery } from "@/lib/resources/search-params";

import type { OperationsSearchParams } from "./validations";

export interface DocumentDto {
  id: string;
  docType: string;
  docNo: string;
  payloadVersion: number;
  payload: Record<string, unknown>;
  title: string;
  occurredAt: string;
  submissionStatus: "draft" | "submitted";
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  postingStatus: "not_required" | "unposted" | "posting" | "posted" | "failed";
  lifecycleStatus: "active" | "cancelled" | "voided" | "archived";
  createIdempotencyKey: string | null;
  amountMinor: string | null;
  currency: string | null;
  memo: string | null;
  counterpartyId: string | null;
  customerId: string | null;
  operationalAccountId: string | null;
  searchText: string;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  postingStartedAt: string | null;
  postedAt: string | null;
  postingError: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  postingOperationId: string | null;
}

export interface DocumentLinkDto {
  id: string;
  fromDocumentId: string;
  toDocumentId: string;
  linkType: "parent" | "depends_on" | "compensates" | "related";
  role: string | null;
  createdAt: string;
}

export interface DocumentOperationDto {
  id: string;
  documentId: string;
  operationId: string;
  kind: string;
  createdAt: string;
}

export interface DocumentDetailsDto {
  document: DocumentDto;
  links: DocumentLinkDto[];
  parent: DocumentDto | null;
  children: DocumentDto[];
  dependsOn: DocumentDto[];
  compensates: DocumentDto[];
  documentOperations: DocumentOperationDto[];
  ledgerOperations: unknown[];
  computed?: unknown;
  extra?: unknown;
}

interface DocumentsListResult {
  data: DocumentDto[];
  total: number;
  limit: number;
  offset: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

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
): Promise<DocumentsListResult> {
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

  const response = await fetchApi(`/v1/docs?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch documents: ${response.status}`);
  }

  return response.json() as Promise<DocumentsListResult>;
}

const getDocumentUncached = async (
  docType: string,
  id: string,
): Promise<DocumentDto | null> => {
  const response = await fetchApi(`/v1/docs/${docType}/${id}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.status}`);
  }

  return response.json() as Promise<DocumentDto>;
};

const getDocumentDetailsUncached = async (
  docType: string,
  id: string,
): Promise<DocumentDetailsDto | null> => {
  const response = await fetchApi(`/v1/docs/${docType}/${id}/details`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch document details: ${response.status}`);
  }

  return response.json() as Promise<DocumentDetailsDto>;
};

export const getDocument = cache(getDocumentUncached);
export const getDocumentDetails = cache(getDocumentDetailsUncached);
