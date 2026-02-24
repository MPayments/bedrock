"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  CurrencyEditGeneralForm,
  type CurrencyGeneralFormValues,
} from "./currency-general-form";
import { useCurrencyDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import type { CurrencyDetails } from "../lib/queries";
import { executeMutation } from "@/lib/resources/http";

function toFormValues(currency: CurrencyDetails): CurrencyGeneralFormValues {
  return {
    name: currency.name,
    code: currency.code,
    symbol: currency.symbol,
    precision: currency.precision,
  };
}

type EditCurrencyFormClientProps = {
  currency: CurrencyDetails;
};

export function EditCurrencyFormClient({ currency }: EditCurrencyFormClientProps) {
  const router = useRouter();
  const { actions } = useCurrencyDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState(() => toFormValues(currency));

  const handleNameChange = useCallback(
    (name: string) => {
      actions.setEditName(currency.id, name);
    },
    [actions, currency.id],
  );

  async function handleSubmit(
    values: CurrencyGeneralFormValues,
  ): Promise<CurrencyGeneralFormValues | void> {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CurrencyDetails>({
      request: () =>
        apiClient.v1.currencies[":id"].$patch({
          param: { id: currency.id },
          json: {
            name: values.name,
            code: values.code,
            symbol: values.symbol,
            precision: values.precision,
          },
        }),
      fallbackMessage: "Не удалось обновить валюту",
      parseData: async (response) => (await response.json()) as CurrencyDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    const nextValues = toFormValues(result.data);
    setInitialValues(nextValues);
    toast.success("Валюта обновлена");
    router.refresh();
    return nextValues;
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.currencies[":id"].$delete({
          param: { id: currency.id },
        }),
      fallbackMessage: "Не удалось удалить валюту",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    actions.clearEdit(currency.id);
    router.push("/entities/currencies");
    return true;
  }

  return (
    <CurrencyEditGeneralForm
      initialValues={initialValues}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onNameChange={handleNameChange}
    />
  );
}
