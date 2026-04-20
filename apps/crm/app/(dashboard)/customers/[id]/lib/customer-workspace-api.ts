import { z } from "zod";

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
  type ClientDocument,
  type CustomerCounterparty,
  type CustomerWorkspaceDetail,
  type SubAgent,
} from "./customer-detail";

type UpdateCustomerWorkspaceInput = {
  description: string | null;
  name: string;
  externalRef: string | null;
};

const CustomerRecordSchema = z.object({
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  name: z.string(),
  externalRef: z.string().nullable(),
  id: z.uuid(),
  updatedAt: z.iso.datetime(),
});

const CounterpartyListItemIdSchema = z.object({
  id: z.uuid(),
});

const CounterpartyListResponseSchema = z.object({
  data: z.array(CounterpartyListItemIdSchema),
});

const CounterpartyDetailSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  fullName: z.string(),
  externalRef: z.string().nullable(),
  relationshipKind: z.enum(["customer_owned", "external"]),
  country: z.string().nullable(),
  kind: z.enum(["individual", "legal_entity"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  partyProfile: z
    .object({
      contacts: z.array(
        z.object({
          type: z.string(),
          value: z.string(),
        }),
      ),
      identifiers: z.array(
        z.object({
          scheme: z.string(),
          value: z.string(),
        }),
      ),
    })
    .passthrough()
    .nullable(),
});

const SubAgentSchema = z.object({
  commissionRate: z.number(),
  counterpartyId: z.string(),
  country: z.string().nullable(),
  fullName: z.string(),
  isActive: z.boolean(),
  kind: z.enum(["individual", "legal_entity"]),
  shortName: z.string(),
});

const CounterpartyAssignmentSchema = z.object({
  counterpartyId: z.uuid(),
  subAgent: SubAgentSchema.nullable(),
  subAgentCounterpartyId: z.uuid().nullable(),
});

const AgreementsListResponseSchema = z.object({
  data: z.array(
    z.object({
      createdAt: z.iso.datetime(),
      currentVersion: z.object({
        contractNumber: z.string().nullable(),
        versionNumber: z.number().int(),
      }),
      id: z.uuid(),
      isActive: z.boolean(),
      updatedAt: z.iso.datetime(),
    }),
  ),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

const AgreementFeeRuleSchema = z.object({
  currencyCode: z.string().nullable(),
  id: z.uuid(),
  kind: z.enum(["agent_fee", "fixed_fee"]),
  unit: z.enum(["bps", "money"]),
  value: z.string(),
});

const CustomerAgreementDetailSchema = z.object({
  createdAt: z.iso.datetime(),
  currentVersion: z.object({
    contractDate: z.string().nullable(),
    contractNumber: z.string().nullable(),
    feeRules: z.array(AgreementFeeRuleSchema),
    id: z.uuid(),
    versionNumber: z.number().int(),
  }),
  id: z.uuid(),
  isActive: z.boolean(),
  organizationId: z.uuid(),
  organizationRequisiteId: z.uuid(),
  updatedAt: z.iso.datetime(),
});

export type CustomerAgreementDetail = z.infer<typeof CustomerAgreementDetailSchema>;

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

function findIdentifier(
  counterparty: z.infer<typeof CounterpartyDetailSchema>,
  scheme: string,
) {
  return (
    counterparty.partyProfile?.identifiers.find(
      (identifier) => identifier.scheme === scheme,
    )?.value ?? null
  );
}

function mapCustomerCounterparty(input: {
  assignment: z.infer<typeof CounterpartyAssignmentSchema>;
  counterparty: z.infer<typeof CounterpartyDetailSchema>;
}): CustomerCounterparty {
  return {
    counterpartyId: input.counterparty.id,
    country: input.counterparty.country,
    createdAt: input.counterparty.createdAt,
    externalRef: input.counterparty.externalRef,
    fullName: input.counterparty.fullName,
    inn: findIdentifier(input.counterparty, "inn"),
    kind: input.counterparty.kind,
    orgName: input.counterparty.shortName,
    relationshipKind: input.counterparty.relationshipKind,
    shortName: input.counterparty.shortName,
    subAgent: input.assignment.subAgent as SubAgent | null,
    subAgentCounterpartyId: input.assignment.subAgentCounterpartyId,
    updatedAt: input.counterparty.updatedAt,
  };
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
  const [customerResponse, counterpartiesResponse, agreementsResponse] =
    await Promise.all([
      apiClient.v1.customers[":id"].$get({
        param: { id: customerId },
      }),
      apiClient.v1.counterparties.$get({
        query: {
          customerId,
          limit: 100,
          offset: 0,
          relationshipKind: ["customer_owned"],
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      }),
      apiClient.v1.agreements.$get({
        query: {
          customerId,
          limit: 100,
          offset: 0,
        },
      }),
    ]);

  if (!customerResponse.ok) {
    throw new Error(
      customerResponse.status === 404
        ? "Клиент не найден"
        : await resolveErrorMessage(customerResponse, "Не удалось загрузить клиента"),
    );
  }

  if (!counterpartiesResponse.ok) {
    throw new Error(
      await resolveErrorMessage(
        counterpartiesResponse,
        "Не удалось загрузить юридические лица клиента",
      ),
    );
  }

  if (!agreementsResponse.ok) {
    throw new Error(
      await resolveErrorMessage(
        agreementsResponse,
        "Не удалось загрузить договоры клиента",
      ),
    );
  }

  const [customer, counterpartiesList, agreementsPayload] = await Promise.all([
    readJsonWithSchema(customerResponse, CustomerRecordSchema),
    readJsonWithSchema(counterpartiesResponse, CounterpartyListResponseSchema),
    readJsonWithSchema(agreementsResponse, AgreementsListResponseSchema),
  ]);

  const counterparties = await Promise.all(
    counterpartiesList.data.map(async ({ id }) => {
      const [detailResponse, assignmentResponse] = await Promise.all([
        apiClient.v1.counterparties[":id"].$get({
          param: { id },
        }),
        apiClient.v1.counterparties[":id"].assignment.$get({
          param: { id },
        }),
      ]);

      if (!detailResponse.ok) {
        throw new Error(
          await resolveErrorMessage(
            detailResponse,
            `Не удалось загрузить субъекта ${id}`,
          ),
        );
      }

      if (!assignmentResponse.ok) {
        throw new Error(
          await resolveErrorMessage(
            assignmentResponse,
            `Не удалось загрузить назначение субъекта ${id}`,
          ),
        );
      }

      const [counterparty, assignment] = await Promise.all([
        readJsonWithSchema(detailResponse, CounterpartyDetailSchema),
        readJsonWithSchema(assignmentResponse, CounterpartyAssignmentSchema),
      ]);

      return mapCustomerCounterparty({
        assignment,
        counterparty,
      });
    }),
  );

  return {
    createdAt: customer.createdAt,
    description: customer.description,
    name: customer.name,
    externalRef: customer.externalRef,
    hasActiveAgreement: agreementsPayload.data.some((agreement) => agreement.isActive),
    id: customer.id,
    counterparties,
    counterpartyCount: counterparties.length,
    primaryCounterpartyId: counterparties[0]?.counterpartyId ?? null,
    updatedAt: customer.updatedAt,
  };
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

export async function listCustomerAgreements(
  customerId: string,
): Promise<CustomerAgreementDetail[]> {
  const listResponse = await apiClient.v1.agreements.$get({
    query: {
      customerId,
      limit: 100,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    },
  });

  if (!listResponse.ok) {
    throw new Error(
      await resolveErrorMessage(listResponse, "Не удалось загрузить договоры"),
    );
  }

  const payload = await readJsonWithSchema(
    listResponse,
    AgreementsListResponseSchema,
  );

  return Promise.all(
    payload.data.map(async (agreement) => {
      const detailResponse = await apiClient.v1.agreements[":id"].$get({
        param: { id: agreement.id },
      });

      if (!detailResponse.ok) {
        throw new Error(
          await resolveErrorMessage(
            detailResponse,
            "Не удалось загрузить договор",
          ),
        );
      }

      return readJsonWithSchema(detailResponse, CustomerAgreementDetailSchema);
    }),
  );
}
