"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  CounterpartyEditGeneralForm,
  type CounterpartyGeneralFormValues,
} from "./organization-general-form";
import { useCounterpartyDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import type {
  CounterpartyDetails,
  CounterpartyGroupOption,
} from "../lib/queries";
import { executeMutation } from "@/lib/resources/http";

type CounterpartyEditFormProps = {
  counterparty: CounterpartyDetails;
  initialGroupOptions: CounterpartyGroupOption[];
  lockedGroupIds?: string[];
  listPath?: string;
  disableSubmit?: boolean;
  initialLoadError?: string | null;
};

function toFormValues(
  counterparty: CounterpartyEditFormProps["counterparty"],
): CounterpartyGeneralFormValues {
  return {
    shortName: counterparty.shortName,
    fullName: counterparty.fullName,
    kind: counterparty.kind,
    country: counterparty.country ?? "",
    description: counterparty.description ?? "",
    customerId: counterparty.customerId ?? "",
    groupIds: counterparty.groupIds,
  };
}

export function CounterpartyEditForm({
  counterparty,
  initialGroupOptions,
  lockedGroupIds,
  listPath = "/entities/counterparties",
  disableSubmit = false,
  initialLoadError = null,
}: CounterpartyEditFormProps) {
  const router = useRouter();
  const { actions } = useCounterpartyDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [initialValues, setInitialValues] = useState(() =>
    toFormValues(counterparty),
  );

  const handleShortNameChange = useCallback(
    (name: string) => {
      actions.setEditName(counterparty.id, name);
    },
    [actions, counterparty.id],
  );

  async function handleSubmit(
    values: CounterpartyGeneralFormValues,
  ): Promise<CounterpartyGeneralFormValues | void> {
    setError(null);
    setSubmitting(true);

    const customerId =
      typeof values.customerId === "string" ? values.customerId.trim() : "";

    const payload = {
      shortName: values.shortName.trim(),
      fullName: values.fullName.trim(),
      kind: values.kind,
      country: values.country.trim() || null,
      description: values.description.trim() || null,
      customerId: customerId || null,
      groupIds: values.groupIds,
    };

    const result = await executeMutation<CounterpartyDetails>({
      request: () =>
        apiClient.v1.counterparties[":id"].$patch({
          param: {
            id: counterparty.id,
          },
          json: payload,
        }),
      fallbackMessage: "Не удалось обновить контрагента",
      parseData: async (response) => (await response.json()) as CounterpartyDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    const nextValues = toFormValues(result.data);
    setInitialValues(nextValues);
    toast.success("Контрагент обновлен");
    router.refresh();
    return nextValues;
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.counterparties[":id"].$delete({
          param: { id: counterparty.id },
        }),
      fallbackMessage: "Не удалось удалить контрагента",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    actions.clearEdit(counterparty.id);
    router.push(listPath.replace(/\/+$/, ""));
    return true;
  }

  return (
    <CounterpartyEditGeneralForm
      initialValues={initialValues}
      groupOptions={initialGroupOptions}
      lockedGroupIds={lockedGroupIds}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={disableSubmit ? undefined : handleSubmit}
      onDelete={handleDelete}
      onShortNameChange={handleShortNameChange}
    />
  );
}
