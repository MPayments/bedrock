import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { API_BASE_URL } from "@/lib/constants";
import {
  parseJsonSafely,
  readJsonWithSchema,
  type HttpResponseLike,
} from "@/lib/api/response";

import {
  ClientDocumentSchema,
  ClientDocumentsSchema,
  CustomerWorkspaceDetailSchema,
  type ClientDocument,
  type CustomerWorkspaceDetail,
} from "./customer-detail";

type UpdateCustomerWorkspaceInput = {
  description: string | null;
  displayName: string;
  externalRef: string | null;
};

function buildLegalEntityDocumentsBasePath(
  customerId: string,
  counterpartyId: string,
) {
  return `${API_BASE_URL}/customers/${customerId}/legal-entities/${counterpartyId}/documents`;
}

function buildCustomerContractPath(
  customerId: string,
  counterpartyId: string,
  input?: {
    format?: "docx" | "pdf";
    lang?: "ru" | "en";
  },
) {
  const query = new URLSearchParams();
  if (input?.format) {
    query.set("format", input.format);
  }
  if (input?.lang) {
    query.set("lang", input.lang);
  }

  const basePath = `${API_BASE_URL}/customers/${customerId}/legal-entities/${counterpartyId}/contract`;
  const suffix = query.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

async function resolveErrorMessage(
  response: HttpResponseLike,
  fallbackMessage: string,
) {
  const payload = await parseJsonSafely(response);
  if (payload && typeof payload === "object") {
    const error =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "message" in payload && typeof payload.message === "string"
          ? payload.message
          : null;

    if (error) {
      return error;
    }
  }

  if (response.status === 404) {
    return "Ресурс не найден";
  }

  return fallbackMessage;
}

async function requestBinaryResource(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
) {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response, fallbackMessage));
  }

  return response;
}

export async function getCustomerWorkspace(customerId: string) {
  const response = await apiClient.v1.customers[":id"].$get({
    param: { id: customerId },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Клиент не найден"
        : await resolveErrorMessage(response, "Не удалось загрузить клиента"),
    );
  }

  return readJsonWithSchema(response, CustomerWorkspaceDetailSchema);
}

export async function updateCustomerWorkspace(
  customerId: string,
  input: UpdateCustomerWorkspaceInput,
) {
  const result = await executeApiMutation<CustomerWorkspaceDetail>({
    request: () =>
      apiClient.v1.customers[":id"].$patch({
        param: { id: customerId },
        json: input,
      }),
    fallbackMessage: "Ошибка сохранения клиента",
    parseData: async (response) =>
      readJsonWithSchema(response, CustomerWorkspaceDetailSchema),
  });

  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.data;
}

export async function archiveCustomer(customerId: string) {
  const result = await executeApiMutation<void>({
    request: () =>
      apiClient.v1.customers[":id"].$delete({
        param: { id: customerId },
      }),
    fallbackMessage: "Ошибка архивации клиента",
    parseData: async () => undefined,
  });

  if (!result.ok) {
    throw new Error(result.message);
  }
}

export async function listCustomerLegalEntityDocuments(
  customerId: string,
  counterpartyId: string,
) {
  const response = await fetch(
    buildLegalEntityDocumentsBasePath(customerId, counterpartyId),
    {
      cache: "no-store",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(
      await resolveErrorMessage(response, "Не удалось загрузить документы"),
    );
  }

  return readJsonWithSchema(response, ClientDocumentsSchema);
}

export async function uploadCustomerLegalEntityDocument(input: {
  customerId: string;
  counterpartyId: string;
  description?: string | null;
  file: File;
}) {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.description?.trim()) {
    formData.append("description", input.description.trim());
  }

  const response = await fetch(
    buildLegalEntityDocumentsBasePath(input.customerId, input.counterpartyId),
    {
      body: formData,
      credentials: "include",
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(
      await resolveErrorMessage(response, "Ошибка загрузки документа"),
    );
  }

  return readJsonWithSchema(response, ClientDocumentSchema);
}

export async function deleteCustomerLegalEntityDocument(input: {
  customerId: string;
  counterpartyId: string;
  documentId: ClientDocument["id"];
}) {
  const response = await fetch(
    `${buildLegalEntityDocumentsBasePath(input.customerId, input.counterpartyId)}/${input.documentId}`,
    {
      credentials: "include",
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(
      await resolveErrorMessage(response, "Ошибка удаления документа"),
    );
  }
}

export async function downloadCustomerLegalEntityDocument(input: {
  customerId: string;
  counterpartyId: string;
  documentId: ClientDocument["id"];
}) {
  return requestBinaryResource(
    `${buildLegalEntityDocumentsBasePath(input.customerId, input.counterpartyId)}/${input.documentId}/download`,
    { method: "GET" },
    "Ошибка скачивания документа",
  );
}

export async function downloadCustomerLegalEntityContract(input: {
  customerId: string;
  counterpartyId: string;
  format: "docx" | "pdf";
  lang: "ru" | "en";
}) {
  return requestBinaryResource(
    buildCustomerContractPath(input.customerId, input.counterpartyId, {
      format: input.format,
      lang: input.lang,
    }),
    { method: "GET" },
    "Ошибка скачивания договора",
  );
}
