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
import { resolveApiErrorMessage } from "@/lib/api-error";
import type { CurrencyDetails } from "../lib/queries";

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
  const { setEditName, clearEditCurrency } = useCurrencyDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState(() => toFormValues(currency));

  const handleNameChange = useCallback(
    (name: string) => {
      setEditName(currency.id, name);
    },
    [currency.id, setEditName],
  );

  async function handleSubmit(
    values: CurrencyGeneralFormValues,
  ): Promise<CurrencyGeneralFormValues | void> {
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiClient.v1.currencies[":id"].$patch({
        param: { id: currency.id },
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
          "Не удалось обновить валюту",
        );
        setError(message);
        toast.error(message);
        return;
      }

      const updated = await res.json();
      const nextValues = toFormValues(updated);
      setInitialValues(nextValues);
      toast.success("Валюта обновлена");
      router.refresh();
      return nextValues;
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось обновить валюту";
      setError(message);
      toast.error(message);
      return;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    try {
      const res = await apiClient.v1.currencies[":id"].$delete({
        param: { id: currency.id },
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
          "Не удалось удалить валюту",
        );
        setError(message);
        toast.error(message);
        return false;
      }

      clearEditCurrency(currency.id);
      router.push("/entities/currencies");
      return true;
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить валюту";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setDeleting(false);
    }
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
