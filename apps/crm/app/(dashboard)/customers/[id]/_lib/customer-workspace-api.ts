import { z } from "zod";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { API_BASE_URL } from "@/lib/constants";
import {
  requestCustomerWorkspace,
  type CrmCustomerWorkspace as CustomerWorkspaceDetail,
} from "@/lib/customer-workspaces";
import {
  parseJsonSafely,
  readJsonWithSchema,
  type HttpResponseLike,
} from "@/lib/api/response";

import {
  ClientDocumentSchema,
  ClientDocumentsSchema,
  type ClientDocument,
} from "./customer-detail";

type UpdateCustomerWorkspaceInput = {
  description: string | null;
  name: string;
  externalRef: string | null;
};

const CustomerRecordSchema = z.object({
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  externalRef: z.string().nullable(),
  id: z.uuid(),
  name: z.string(),
  updatedAt: z.iso.datetime(),
});

function buildCounterpartyDocumentsBasePath(
  customerId: string,
  counterpartyId: string,
) {
  return `${API_BASE_URL}/customers/${customerId}/counterparties/${counterpartyId}/documents`;
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

  const basePath = `${API_BASE_URL}/customers/${customerId}/counterparties/${counterpartyId}/contract`;
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

export async function getCustomerWorkspace(
  customerId: string,
): Promise<CustomerWorkspaceDetail> {
  return requestCustomerWorkspace(customerId);
}

export async function updateCustomerWorkspace(
  customerId: string,
  input: UpdateCustomerWorkspaceInput,
) {
  const result = await executeApiMutation<z.infer<typeof CustomerRecordSchema>>({
    request: () =>
      apiClient.v1.customers[":id"].$patch({
        param: { id: customerId },
        json: input,
      }),
    fallbackMessage: "Ошибка сохранения клиента",
    parseData: async (response) =>
      readJsonWithSchema(response, CustomerRecordSchema),
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

export async function listCustomerCounterpartyDocuments(
  customerId: string,
  counterpartyId: string,
) {
  const response = await fetch(
    buildCounterpartyDocumentsBasePath(customerId, counterpartyId),
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

export async function uploadCustomerCounterpartyDocument(input: {
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
    buildCounterpartyDocumentsBasePath(input.customerId, input.counterpartyId),
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

export async function deleteCustomerCounterpartyDocument(input: {
  customerId: string;
  counterpartyId: string;
  documentId: ClientDocument["id"];
}) {
  const response = await fetch(
    `${buildCounterpartyDocumentsBasePath(input.customerId, input.counterpartyId)}/${input.documentId}`,
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

export async function downloadCustomerCounterpartyDocument(input: {
  customerId: string;
  counterpartyId: string;
  documentId: ClientDocument["id"];
}) {
  return requestBinaryResource(
    `${buildCounterpartyDocumentsBasePath(input.customerId, input.counterpartyId)}/${input.documentId}/download`,
    { method: "GET" },
    "Ошибка скачивания документа",
  );
}

export async function downloadCustomerCounterpartyContract(input: {
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
