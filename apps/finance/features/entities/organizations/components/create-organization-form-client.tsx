"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { PartyLegalEntityBundleInput } from "@bedrock/parties/contracts";
import { LegalEntityBundleEditor } from "@bedrock/sdk-parties-ui/components/legal-entity-bundle-editor";
import {
  OrganizationGeneralEditor,
  type OrganizationGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/organization-general-editor";
import { createSeededLegalEntityBundle } from "@bedrock/sdk-parties-ui/lib/legal-entity";
import { toast } from "@bedrock/sdk-ui/components/sonner";

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

export function CreateOrganizationFormClient({
  detailsBasePath = "/treasury/organizations",
}: CreateOrganizationFormClientProps) {
  const router = useRouter();
  const { actions } = useOrganizationDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<OrganizationGeneralFormValues>(
    EMPTY_ORGANIZATION_VALUES,
  );
  const [legalEntityDraft, setLegalEntityDraft] =
    useState<PartyLegalEntityBundleInput | null>(null);
  const legalEntitySeed = useMemo(
    () => ({
      fullName: draftValues.fullName || EMPTY_ORGANIZATION_VALUES.fullName,
      shortName: draftValues.shortName || EMPTY_ORGANIZATION_VALUES.shortName,
      countryCode: draftValues.country || EMPTY_ORGANIZATION_VALUES.country,
    }),
    [draftValues.country, draftValues.fullName, draftValues.shortName],
  );

  function resolveCreateLegalEntityBundle(
    values: OrganizationGeneralFormValues,
    bundle: PartyLegalEntityBundleInput | null,
  ) {
    const fallbackCountryCode = values.country.trim() || null;

    const resolvedBundle = bundle
      ? {
          ...bundle,
          profile: {
            ...bundle.profile,
            fullName: bundle.profile.fullName.trim() || values.fullName.trim(),
            shortName:
              bundle.profile.shortName.trim() || values.shortName.trim(),
            countryCode: bundle.profile.countryCode ?? fallbackCountryCode,
          },
        }
      : createSeededLegalEntityBundle({
          fullName: values.fullName,
          shortName: values.shortName,
          countryCode: values.country || null,
        });

    return resolvedBundle;
  }

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
                ? resolveCreateLegalEntityBundle(values, legalEntityDraft)
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
    <div className="space-y-6">
      <OrganizationGeneralEditor
        initialValues={EMPTY_ORGANIZATION_VALUES}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        onShortNameChange={actions.setCreateName}
        onValuesChange={setDraftValues}
        submitLabel="Создать"
        submittingLabel="Создание..."
        disableSubmitUntilDirty={false}
        showDates={false}
      />
      {draftValues.kind === "legal_entity" ? (
        <LegalEntityBundleEditor
          bundle={legalEntityDraft}
          seed={legalEntitySeed}
          submitting={submitting}
          error={error}
          title="Мастер-данные организации"
          showActions={false}
          onChange={(bundle) => {
            setLegalEntityDraft(bundle);
          }}
        />
      ) : null}
    </div>
  );
}
