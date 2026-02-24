"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  CurrencyCreateGeneralForm,
  type CurrencyGeneralFormValues,
} from "./currency-general-form";
import { useCurrencyDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { resolveApiErrorMessage } from "@/lib/api-error";

export function CreateCurrencyFormClient() {
  const router = useRouter();
  const { setCreateName } = useCurrencyDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValues = useMemo<CurrencyGeneralFormValues>(
    () => ({
      name: "",
      code: "",
      symbol: "",
      precision: 2,
    }),
    [],
  );

  async function handleSubmit(values: CurrencyGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiClient.v1.currencies.$post({
        json: {
          name: values.name,
          code: values.code,
          symbol: values.symbol,
          precision: values.precision,
        },
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
          "Не удалось создать валюту",
        );
        setError(message);
        toast.error(message);
        return;
      }

      const created = await res.json();
      toast.success("Валюта создана");
      router.push(`/entities/currencies/${created.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать валюту";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CurrencyCreateGeneralForm
      initialValues={initialValues}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onNameChange={setCreateName}
    />
  );
}
