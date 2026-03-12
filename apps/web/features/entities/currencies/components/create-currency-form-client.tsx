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
import { executeMutation } from "@/lib/resources/http";

type CreatedCurrency = {
  id: string;
};

export function CreateCurrencyFormClient() {
  const router = useRouter();
  const { actions } = useCurrencyDraftName();
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

    const result = await executeMutation<CreatedCurrency>({
      request: () =>
        apiClient.v1.currencies.$post({
          json: {
            name: values.name,
            code: values.code,
            symbol: values.symbol,
            precision: values.precision,
          },
        }),
      fallbackMessage: "Не удалось создать валюту",
      parseData: async (response) => (await response.json()) as CreatedCurrency,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Валюта создана");
    router.push(`/entities/currencies/${result.data.id}`);
  }

  return (
    <CurrencyCreateGeneralForm
      initialValues={initialValues}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onNameChange={actions.setCreateName}
    />
  );
}
