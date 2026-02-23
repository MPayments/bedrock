"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CounterpartyCreateGeneralForm,
  type CounterpartyGeneralFormValues,
} from "../components/organization-general-form";
import type { CounterpartyGroupOption } from "../lib/queries";
import { useCounterpartyCreateDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";

type CreateCounterpartyFormClientProps = {
  initialGroupOptions: CounterpartyGroupOption[];
  initialLoadError?: string | null;
};

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

export function CreateCounterpartyFormClient({
  initialGroupOptions,
  initialLoadError = null,
}: CreateCounterpartyFormClientProps) {
  const router = useRouter();
  const { setCreateName, resetCreateName } = useCounterpartyCreateDraftName();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);

  const initialValues = useMemo<CounterpartyGeneralFormValues>(
    () => ({
      shortName: "",
      fullName: "",
      kind: "legal_entity",
      country: "",
      externalId: "",
      description: "",
      customerId: "",
      groupIds: [],
    }),
    [],
  );

  async function handleSubmit(values: CounterpartyGeneralFormValues) {
    setError(null);
    const customerId =
      typeof values.customerId === "string" ? values.customerId.trim() : "";

    const payload = {
      shortName: values.shortName.trim(),
      fullName: values.fullName.trim(),
      kind: values.kind,
      country: values.country.trim() || undefined,
      externalId: values.externalId.trim() || undefined,
      description: values.description.trim() || undefined,
      customerId: customerId || null,
      groupIds: values.groupIds,
    };

    setSubmitting(true);

    try {
      const res = await apiClient.v1.counterparties.$post({
        json: payload,
      });

      if (!res.ok) {
        let message = `Не удалось создать контрагента (${res.status})`;
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

      const created = await res.json();
      resetCreateName();
      router.push(`/entities/counterparties/${created.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать контрагента";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CounterpartyCreateGeneralForm
      initialValues={initialValues}
      groupOptions={initialGroupOptions}
      submitting={submitting}
      error={error}
      onShortNameChange={setCreateName}
      onSubmit={handleSubmit}
    />
  );
}
