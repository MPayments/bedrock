"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { PartyLegalEntityBundleInput } from "@bedrock/parties/contracts";
import {
  CounterpartyGeneralEditor,
  type CounterpartyGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/counterparty-general-editor";
import { LegalEntityBundleEditor } from "@bedrock/sdk-parties-ui/components/legal-entity-bundle-editor";
import { createSeededLegalEntityBundle } from "@bedrock/sdk-parties-ui/lib/legal-entity";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { CounterpartyGroupOption } from "../lib/queries";
import { useCounterpartyDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type CreateCounterpartyFormClientProps = {
  initialGroupOptions: CounterpartyGroupOption[];
  initialGroupIds?: string[];
  lockedGroupIds?: string[];
  detailsBasePath?: string;
  disableSubmit?: boolean;
  initialLoadError?: string | null;
};

type CreatedCounterparty = {
  id: string;
};

const EMPTY_GROUP_IDS: string[] = [];

export function CreateCounterpartyFormClient({
  initialGroupOptions,
  initialGroupIds = EMPTY_GROUP_IDS,
  lockedGroupIds,
  detailsBasePath = "/entities/counterparties",
  disableSubmit = false,
  initialLoadError = null,
}: CreateCounterpartyFormClientProps) {
  const router = useRouter();
  const { actions } = useCounterpartyDraftName();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [draftValues, setDraftValues] = useState<CounterpartyGeneralFormValues>(
    () => ({
      shortName: "",
      fullName: "",
      kind: "legal_entity",
      country: "",
      description: "",
      customerId: "",
      groupIds: Array.from(new Set(initialGroupIds)),
    }),
  );
  const [legalEntityDraft, setLegalEntityDraft] =
    useState<PartyLegalEntityBundleInput | null>(null);

  const initialValues = useMemo<CounterpartyGeneralFormValues>(
    () => ({
      shortName: "",
      fullName: "",
      kind: "legal_entity",
      country: "",
      description: "",
      customerId: "",
      groupIds: Array.from(new Set(initialGroupIds)),
    }),
    [initialGroupIds],
  );
  const legalEntitySeed = useMemo(
    () => ({
      fullName: draftValues.fullName,
      shortName: draftValues.shortName,
      countryCode: draftValues.country || null,
    }),
    [draftValues.country, draftValues.fullName, draftValues.shortName],
  );

  function resolveCreateLegalEntityBundle(
    values: CounterpartyGeneralFormValues,
    bundle: PartyLegalEntityBundleInput | null,
  ) {
    const fallbackCountryCode = values.country.trim() || null;

    return bundle
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
          fullName: values.fullName.trim(),
          shortName: values.shortName.trim(),
          countryCode: values.country.trim() || null,
        });
  }

  async function handleSubmit(values: CounterpartyGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    const customerId =
      typeof values.customerId === "string" ? values.customerId.trim() : "";

    const payload = {
      shortName: values.shortName.trim(),
      fullName: values.fullName.trim(),
      kind: values.kind,
      country: values.country.trim() || undefined,
      description: values.description.trim() || undefined,
      customerId: customerId || null,
      groupIds: values.groupIds,
      legalEntity:
        values.kind === "legal_entity"
          ? resolveCreateLegalEntityBundle(values, legalEntityDraft)
          : undefined,
    };

    const result = await executeMutation<CreatedCounterparty>({
      request: () =>
        apiClient.v1.counterparties.$post({
          json: payload,
        }),
      fallbackMessage: "Не удалось создать контрагента",
      parseData: async (response) => (await response.json()) as CreatedCounterparty,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Контрагент создан");
    router.push(`${detailsBasePath.replace(/\/+$/, "")}/${result.data.id}`);
  }

  return (
    <div className="space-y-6">
      <CounterpartyGeneralEditor
        initialValues={initialValues}
        groupOptions={initialGroupOptions}
        lockedGroupIds={lockedGroupIds}
        submitting={submitting}
        error={error}
        onShortNameChange={actions.setCreateName}
        onSubmit={disableSubmit ? undefined : handleSubmit}
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
          title="Мастер-данные контрагента"
          showActions={false}
          onChange={(bundle) => {
            setLegalEntityDraft(bundle);
          }}
        />
      ) : null}
    </div>
  );
}
