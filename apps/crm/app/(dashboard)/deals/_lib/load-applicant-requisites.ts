import { z } from "zod";

import { apiClient } from "@/lib/api-client";
import { readJsonWithSchema } from "@/lib/api/response";

import type { CrmApplicantRequisiteOption } from "../_components/deal-intake-form";

const RequisiteListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
      providerId: z.uuid(),
    }),
  ),
});

const RequisiteDetailSchema = z.object({
  id: z.uuid(),
  kind: z.literal("bank"),
  label: z.string(),
  beneficiaryName: z.string().nullable(),
  identifiers: z.array(
    z.object({
      scheme: z.string(),
      value: z.string(),
    }),
  ),
  providerId: z.uuid(),
});

const RequisiteProviderDetailSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
});

function findIdentifier(
  requisite: z.infer<typeof RequisiteDetailSchema>,
  scheme: string,
) {
  return (
    requisite.identifiers.find((identifier) => identifier.scheme === scheme)
      ?.value ?? null
  );
}

export async function loadApplicantRequisites(
  counterpartyId: string,
): Promise<CrmApplicantRequisiteOption[]> {
  const response = await apiClient.v1.counterparties[":id"].requisites.$get({
    param: { id: counterpartyId },
    query: {
      limit: 100,
      offset: 0,
    },
  });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить реквизиты: ${response.status}`);
  }

  const listPayload = await readJsonWithSchema(response, RequisiteListResponseSchema);
  const bankItems = listPayload.data.filter((item) => item.kind === "bank");

  const requisites = await Promise.all(
    bankItems.map(async (item) => {
      const detailResponse = await apiClient.v1.requisites[":id"].$get({
        param: { id: item.id },
      });

      if (!detailResponse.ok) {
        throw new Error(
          `Не удалось загрузить реквизит ${item.id}: ${detailResponse.status}`,
        );
      }

      return readJsonWithSchema(detailResponse, RequisiteDetailSchema);
    }),
  );

  const providerIds = Array.from(new Set(requisites.map((item) => item.providerId)));
  const providers = new Map(
    await Promise.all(
      providerIds.map(async (providerId) => {
        const providerResponse =
          await apiClient.v1.requisites.providers[":id"].$get({
            param: { id: providerId },
          });

        if (!providerResponse.ok) {
          throw new Error(
            `Не удалось загрузить банк ${providerId}: ${providerResponse.status}`,
          );
        }

        return [
          providerId,
          await readJsonWithSchema(
            providerResponse,
            RequisiteProviderDetailSchema,
          ),
        ] as const;
      }),
    ),
  );

  return requisites.map((requisite) => ({
    accountNo: findIdentifier(requisite, "local_account_number"),
    beneficiaryName: requisite.beneficiaryName,
    iban: findIdentifier(requisite, "iban"),
    id: requisite.id,
    label: requisite.label,
    providerLabel: providers.get(requisite.providerId)?.displayName ?? null,
  }));
}
