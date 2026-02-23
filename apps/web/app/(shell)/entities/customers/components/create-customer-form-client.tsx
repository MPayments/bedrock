"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  CustomerCreateGeneralForm,
  type CustomerGeneralFormValues,
} from "./customer-general-form";
import { useCustomerDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { resolveApiErrorMessage } from "@/lib/api-error";

export function CreateCustomerFormClient() {
  const router = useRouter();
  const { setCreateName, resetCreateName } = useCustomerDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValues = useMemo<CustomerGeneralFormValues>(
    () => ({
      displayName: "",
      externalRef: "",
    }),
    [],
  );

  async function handleSubmit(values: CustomerGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiClient.v1.customers.$post({
        json: {
          displayName: values.displayName,
          externalRef: values.externalRef || undefined,
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
          "Не удалось создать клиента",
        );
        setError(message);
        toast.error(message);
        return;
      }

      const created = await res.json();
      toast.success("Клиент создан");
      resetCreateName();
      router.push(`/entities/customers/${created.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать клиента";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerCreateGeneralForm
      initialValues={initialValues}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onDisplayNameChange={setCreateName}
    />
  );
}
