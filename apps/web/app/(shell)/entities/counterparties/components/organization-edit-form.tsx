"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CounterpartyEditGeneralForm,
  type CounterpartyGeneralFormValues,
} from "./organization-general-form";
import { useCounterpartyCreateDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import type {
  CounterpartyDetails,
  CounterpartyGroupOption,
} from "../lib/queries";

type CounterpartyEditFormProps = {
  counterparty: CounterpartyDetails;
  initialGroupOptions: CounterpartyGroupOption[];
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
    externalId: counterparty.externalId ?? "",
    description: counterparty.description ?? "",
    customerId: counterparty.customerId ?? "",
    groupIds: counterparty.groupIds,
  };
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  if ("error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return null;
}

export function CounterpartyEditForm({
  counterparty,
  initialGroupOptions,
  initialLoadError = null,
}: CounterpartyEditFormProps) {
  const router = useRouter();
  const { setEditName } = useCounterpartyCreateDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [initialValues, setInitialValues] = useState(() =>
    toFormValues(counterparty),
  );
  const handleShortNameChange = useCallback(
    (name: string) => {
      setEditName(counterparty.id, name);
    },
    [counterparty.id, setEditName],
  );

  async function handleSubmit(
    values: CounterpartyGeneralFormValues,
  ): Promise<CounterpartyGeneralFormValues | void> {
    setError(null);
    const customerId =
      typeof values.customerId === "string" ? values.customerId.trim() : "";

    const payload = {
      shortName: values.shortName.trim(),
      fullName: values.fullName.trim(),
      kind: values.kind,
      country: values.country.trim() || null,
      externalId: values.externalId.trim() || null,
      description: values.description.trim() || null,
      customerId: customerId || null,
      groupIds: values.groupIds,
    };

    setSubmitting(true);

    try {
      const res = await apiClient.v1.counterparties[":id"].$patch({
        param: {
          id: counterparty.id,
        },
        json: payload,
      });

      if (!res.ok) {
        let message = `Не удалось обновить контрагента (${res.status})`;
        try {
          const body = await res.json();
          const extracted = extractErrorMessage(body);
          if (extracted) message = extracted;
        } catch {
          // Ignore non-JSON error payloads.
        }

        setError(message);
        return;
      }

      const updated = await res.json();
      const nextValues = toFormValues(updated);
      setInitialValues(nextValues);
      router.refresh();
      return nextValues;
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось обновить контрагента";
      setError(message);
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CounterpartyEditGeneralForm
      initialValues={initialValues}
      groupOptions={initialGroupOptions}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onShortNameChange={handleShortNameChange}
    />
  );
}
