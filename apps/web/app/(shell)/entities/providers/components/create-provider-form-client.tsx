"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  ProviderCreateGeneralForm,
  type ProviderGeneralFormValues,
} from "./provider-general-form";
import { useProviderDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type CreatedProvider = {
  id: string;
};

const INITIAL_VALUES: ProviderGeneralFormValues = {
  name: "",
  type: "bank",
  country: "",
  address: "",
  contact: "",
  bic: "",
  swift: "",
};

export function CreateProviderFormClient() {
  const router = useRouter();
  const { actions } = useProviderDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ProviderGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedProvider>({
      request: () =>
        apiClient.v1["account-providers"].$post({
          json: {
            name: values.name,
            type: values.type,
            country: values.country,
            address: values.address || null,
            contact: values.contact || null,
            bic: values.bic || null,
            swift: values.swift || null,
          },
        }),
      fallbackMessage: "Не удалось создать провайдера",
      parseData: async (response) => (await response.json()) as CreatedProvider,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Провайдер создан");
    router.push(`/entities/providers/${result.data.id}`);
  }

  return (
    <ProviderCreateGeneralForm
      initialValues={INITIAL_VALUES}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onNameChange={actions.setCreateName}
    />
  );
}
