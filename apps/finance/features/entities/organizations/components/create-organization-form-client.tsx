"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  OrganizationCreateGeneralForm,
  type OrganizationGeneralFormValues,
} from "./organization-form";
import { useOrganizationDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type CreatedOrganization = {
  id: string;
};

type CreateOrganizationFormClientProps = {
  detailsBasePath?: string;
};

const EMPTY_ORGANIZATION_VALUES: OrganizationGeneralFormValues = {
  shortName: "",
  fullName: "",
  kind: "legal_entity",
  country: "",
  externalId: "",
  description: "",
};

function buildLegalEntityBundle(values: OrganizationGeneralFormValues) {
  return {
    profile: {
      fullName: values.fullName,
      shortName: values.shortName,
      fullNameI18n: null,
      shortNameI18n: null,
      legalFormCode: null,
      legalFormLabel: null,
      legalFormLabelI18n: null,
      countryCode: values.country || null,
      jurisdictionCode: null,
      registrationAuthority: null,
      registeredAt: null,
      businessActivityCode: null,
      businessActivityText: null,
      status: null,
    },
    identifiers: [],
    addresses: [],
    contacts: [],
    representatives: [],
    licenses: [],
  };
}

export function CreateOrganizationFormClient({
  detailsBasePath = "/treasury/organizations",
}: CreateOrganizationFormClientProps) {
  const router = useRouter();
  const { actions } = useOrganizationDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: OrganizationGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedOrganization>({
      request: () =>
        apiClient.v1.organizations.$post({
          json: {
            shortName: values.shortName,
            fullName: values.fullName,
            kind: values.kind,
            country: values.country || undefined,
            externalId: values.externalId || undefined,
            description: values.description || undefined,
            legalEntity:
              values.kind === "legal_entity"
                ? buildLegalEntityBundle(values)
                : undefined,
          },
        }),
      fallbackMessage: "Не удалось создать организацию",
      parseData: async (response) => (await response.json()) as CreatedOrganization,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Организация создана");
    router.push(`${detailsBasePath.replace(/\/+$/, "")}/${result.data.id}`);
  }

  return (
    <OrganizationCreateGeneralForm
      initialValues={EMPTY_ORGANIZATION_VALUES}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onShortNameChange={actions.setCreateName}
    />
  );
}
