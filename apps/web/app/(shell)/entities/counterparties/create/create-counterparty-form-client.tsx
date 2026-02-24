"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  CounterpartyCreateGeneralForm,
  type CounterpartyGeneralFormValues,
} from "../components/organization-general-form";
import type { CounterpartyGroupOption } from "../lib/queries";
import { useCounterpartyDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type CreateCounterpartyFormClientProps = {
  initialGroupOptions: CounterpartyGroupOption[];
  initialGroupIds?: string[];
  allowedRootCode?: "treasury" | "customers";
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
  allowedRootCode,
  lockedGroupIds,
  detailsBasePath = "/entities/counterparties",
  disableSubmit = false,
  initialLoadError = null,
}: CreateCounterpartyFormClientProps) {
  const router = useRouter();
  const { actions } = useCounterpartyDraftName();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);

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
    <CounterpartyCreateGeneralForm
      initialValues={initialValues}
      groupOptions={initialGroupOptions}
      allowedRootCode={allowedRootCode}
      lockedGroupIds={lockedGroupIds}
      submitting={submitting}
      error={error}
      onShortNameChange={actions.setCreateName}
      onSubmit={disableSubmit ? undefined : handleSubmit}
    />
  );
}
