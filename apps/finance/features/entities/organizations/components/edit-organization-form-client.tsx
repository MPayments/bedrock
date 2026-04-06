"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import type { PartyLegalEntityBundleInput } from "@bedrock/parties/contracts";
import type { PartyLegalEntityBundleSource } from "@bedrock/sdk-parties-ui/lib/legal-entity";
import { LegalEntityBundleEditor } from "@bedrock/sdk-parties-ui/components/legal-entity-bundle-editor";
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
  const [savingLegalEntity, setSavingLegalEntity] = useState(false);
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
        apiClient.v1.organizations[":id"].$patch({
          param: { id: current.id },
          json: {
            externalId: values.externalId || null,
            description: values.description || null,
          },
        }),
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

  async function handleLegalEntitySubmit(
    bundle: PartyLegalEntityBundleInput,
  ) {
    setError(null);
    setSavingLegalEntity(true);

    const result = await executeMutation<SerializedOrganization>({
      request: async () => {
        const response =
          await apiClient.v1.organizations[":id"]["legal-entity"].$put({
            param: { id: current.id },
            json: bundle,
          });

        if (!response.ok) {
          return response;
        }

        return apiClient.v1.organizations[":id"].$get({
          param: { id: current.id },
        });
      },
      fallbackMessage: "Не удалось обновить юридические данные организации",
      parseData: async (response) => (await response.json()) as SerializedOrganization,
    });

    setSavingLegalEntity(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    setCurrent(result.data);
    setInitialValues(toFormValues(result.data));
    toast.success("Юридические данные организации обновлены");
    router.refresh();

    return (result.data.legalEntity as PartyLegalEntityBundleSource | null) ?? bundle;
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
    <div className="space-y-6">
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
      {current.kind === "legal_entity" ? (
        <LegalEntityBundleEditor
          bundle={current.legalEntity as PartyLegalEntityBundleSource | null}
          seed={{
            fullName: current.fullName,
            shortName: current.shortName,
            countryCode: current.country,
          }}
          submitting={savingLegalEntity}
          error={error}
          onSubmit={handleLegalEntitySubmit}
          title="Мастер-данные организации"
        />
      ) : null}
    </div>
  );
}
