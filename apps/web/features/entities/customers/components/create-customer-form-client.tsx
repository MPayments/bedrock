"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@multihansa/ui/components/sonner";

import {
  CustomerCreateGeneralForm,
  type CustomerGeneralFormValues,
} from "./customer-general-form";
import { useCustomerDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type CreatedCustomer = {
  id: string;
};

export function CreateCustomerFormClient() {
  const router = useRouter();
  const { actions } = useCustomerDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValues = useMemo<CustomerGeneralFormValues>(
    () => ({
      displayName: "",
      externalRef: "",
      description: "",
    }),
    [],
  );

  async function handleSubmit(values: CustomerGeneralFormValues) {
    setError(null);
    setSubmitting(true);
    const payload = {
      displayName: values.displayName,
      externalRef: values.externalRef || undefined,
      description: values.description || undefined,
    };

    const result = await executeMutation<CreatedCustomer>({
      request: () =>
        apiClient.v1.parties.customers.$post({
          json: payload,
        }),
      fallbackMessage: "Не удалось создать клиента",
      parseData: async (response) => (await response.json()) as CreatedCustomer,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Клиент создан");
    router.push(`/entities/parties/customers/${result.data.id}`);
  }

  return (
    <CustomerCreateGeneralForm
      initialValues={initialValues}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onDisplayNameChange={actions.setCreateName}
    />
  );
}
