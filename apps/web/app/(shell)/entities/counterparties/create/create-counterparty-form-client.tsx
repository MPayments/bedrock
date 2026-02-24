"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  CounterpartyCreateGeneralForm,
  type CounterpartyGeneralFormValues,
} from "../components/organization-general-form";
import type { CounterpartyGroupOption } from "../lib/queries";
import { useCounterpartyCreateDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { resolveApiErrorMessage } from "@/lib/api-error";

type CreateCounterpartyFormClientProps = {
  initialGroupOptions: CounterpartyGroupOption[];
  initialLoadError?: string | null;
};

export function CreateCounterpartyFormClient({
  initialGroupOptions,
  initialLoadError = null,
}: CreateCounterpartyFormClientProps) {
  const router = useRouter();
  const { setCreateName } = useCounterpartyCreateDraftName();

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
        let payload: unknown = null;
        try {
          payload = await res.json();
        } catch {
          // Ignore non-JSON error payloads.
        }

        const message = resolveApiErrorMessage(
          res.status,
          payload,
          "Не удалось создать контрагента",
        );
        setError(message);
        toast.error(message);
        return;
      }

      const created = await res.json();
      toast.success("Контрагент создан");
      router.push(`/entities/counterparties/${created.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать контрагента";
      setError(message);
      toast.error(message);
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
