import { cache } from "react";
import { headers } from "next/headers";

import { DOCUMENTS_LIST_CONTRACT } from "@bedrock/documents/contracts";

import {
  readJsonWithSchema,
  requestOk,
} from "@/lib/api/response";
import { createResourceListQuery } from "@/lib/resources/search-params";

import {
  DocumentDetailsSchema,
  DocumentSchema,
  DocumentsListResponseSchema,
  type DocumentDetailsDto,
  type DocumentDto,
  type DocumentsListResponseDto,
} from "./schemas";
import type { OperationsSearchParams } from "./validations";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";

export type {
  DocumentDetailsDto,
  DocumentDto,
  DocumentLinkDto,
  DocumentOperationDto,
} from "./schemas";

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

function createDocumentsListQuery(search: OperationsSearchParams) {
  return createResourceListQuery(DOCUMENTS_LIST_CONTRACT, search);
}

export async function getDocuments(
  search: OperationsSearchParams,
): Promise<DocumentsListResponseDto> {
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
    await fetchApi(`/v1/documents?${query.toString()}`),
    "Не удалось загрузить документы",
  );

  return readJsonWithSchema(response, DocumentsListResponseSchema);
}

const getDocumentUncached = async (
  docType: string,
  id: string,
): Promise<DocumentDto | null> => {
  const response = await fetchApi(`/v1/documents/${docType}/${id}`);

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
  const response = await fetchApi(`/v1/documents/${docType}/${id}/details`);

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить детали документа");
  return readJsonWithSchema(response, DocumentDetailsSchema);
};

export const getDocument = cache(getDocumentUncached);
export const getDocumentDetails = cache(getDocumentDetailsUncached);
