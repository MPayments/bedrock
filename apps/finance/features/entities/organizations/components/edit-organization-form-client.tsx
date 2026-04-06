"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  OrganizationEditGeneralForm,
  type OrganizationGeneralFormValues,
} from "./organization-form";
import type { SerializedOrganization } from "../lib/types";
import { useOrganizationDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type EditOrganizationFormClientProps = {
  organization: SerializedOrganization;
  listPath?: string;
};

type OrganizationLegalProfileResponse = {
  fullName: string;
  shortName: string;
  fullNameI18n: Record<string, string | null> | null;
  shortNameI18n: Record<string, string | null> | null;
  legalFormCode: string | null;
  legalFormLabel: string | null;
  legalFormLabelI18n: Record<string, string | null> | null;
  countryCode: string | null;
  jurisdictionCode: string | null;
  registrationAuthority: string | null;
  registeredAt: string | null;
  businessActivityCode: string | null;
  businessActivityText: string | null;
  status: string | null;
} | null;

function buildLegalProfilePayload(
  values: OrganizationGeneralFormValues,
  current: OrganizationLegalProfileResponse,
) {
  return {
    fullName: values.fullName,
    shortName: values.shortName,
    fullNameI18n: current?.fullNameI18n ?? null,
    shortNameI18n: current?.shortNameI18n ?? null,
    legalFormCode: current?.legalFormCode ?? null,
    legalFormLabel: current?.legalFormLabel ?? null,
    legalFormLabelI18n: current?.legalFormLabelI18n ?? null,
    countryCode: values.country || null,
    jurisdictionCode: current?.jurisdictionCode ?? null,
    registrationAuthority: current?.registrationAuthority ?? null,
    registeredAt: current?.registeredAt ?? null,
    businessActivityCode: current?.businessActivityCode ?? null,
    businessActivityText: current?.businessActivityText ?? null,
    status: current?.status ?? null,
  };
}

function toFormValues(
  organization: SerializedOrganization,
): OrganizationGeneralFormValues {
  return {
    shortName: organization.shortName,
    fullName: organization.fullName,
    kind: organization.kind,
    country: organization.country ?? "",
    externalId: organization.externalId ?? "",
    description: organization.description ?? "",
  };
}

export function EditOrganizationFormClient({
  organization,
  listPath = "/treasury/organizations",
}: EditOrganizationFormClientProps) {
  const router = useRouter();
  const { actions } = useOrganizationDraftName();
  const [current, setCurrent] = useState(organization);
  const [initialValues, setInitialValues] = useState(() =>
    toFormValues(organization),
  );
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShortNameChange = useCallback(
    (name: string) => {
      actions.setEditName(current.id, name);
    },
    [actions, current.id],
  );

  async function handleSubmit(
    values: OrganizationGeneralFormValues,
  ): Promise<OrganizationGeneralFormValues | void> {
    if (values.kind !== current.kind) {
      const message = "Смена типа организации в этой форме не поддерживается";
      setError(message);
      toast.error(message);
      return;
    }

    setError(null);
    setSubmitting(true);

    const result = await executeMutation<SerializedOrganization>({
      request: () =>
        (async () => {
          const patchResponse = await apiClient.v1.organizations[":id"].$patch({
            param: { id: current.id },
            json: {
              externalId: values.externalId || null,
              description: values.description || null,
            },
          });

          if (!patchResponse.ok || values.kind !== "legal_entity") {
            return patchResponse;
          }

          const legalProfileResponse =
            await apiClient.v1.organizations[":id"]["legal-profile"].$get({
              param: { id: current.id },
            });

          if (!legalProfileResponse.ok) {
            return legalProfileResponse;
          }

          const currentLegalProfile =
            (await legalProfileResponse.json()) as OrganizationLegalProfileResponse;
          const putLegalProfileResponse =
            await apiClient.v1.organizations[":id"]["legal-profile"].$put({
              param: { id: current.id },
              json: buildLegalProfilePayload(values, currentLegalProfile),
            });

          if (!putLegalProfileResponse.ok) {
            return putLegalProfileResponse;
          }

          return apiClient.v1.organizations[":id"].$get({
            param: { id: current.id },
          });
        })(),
      fallbackMessage: "Не удалось обновить организацию",
      parseData: async (response) => (await response.json()) as SerializedOrganization,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    const nextValues = toFormValues(result.data);
    setCurrent(result.data);
    setInitialValues(nextValues);
    toast.success("Организация обновлена");
    router.refresh();

    return nextValues;
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.organizations[":id"].$delete({
          param: { id: current.id },
        }),
      fallbackMessage: "Не удалось удалить организацию",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    toast.success("Организация удалена");
    actions.clearEdit(current.id);
    router.push(listPath.replace(/\/+$/, ""));
    return true;
  }

  return (
    <OrganizationEditGeneralForm
      initialValues={initialValues}
      createdAt={current.createdAt}
      updatedAt={current.updatedAt}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onShortNameChange={handleShortNameChange}
    />
  );
}
