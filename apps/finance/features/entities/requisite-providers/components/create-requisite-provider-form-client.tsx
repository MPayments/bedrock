"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createCompactProviderInput } from "@bedrock/sdk-parties-ui/lib/requisite-provider-master-data";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  RequisiteProviderForm,
  type RequisiteProviderFormValues,
} from "./requisite-provider-form";

type CreatedRequisiteProvider = {
  id: string;
};

export function CreateRequisiteProviderFormClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: RequisiteProviderFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedRequisiteProvider>({
      request: () =>
        apiClient.v1.requisites.providers.$post({
          json: createCompactProviderInput({
            kind: values.kind,
            legalName: values.name,
            description: values.description,
            country: values.country,
            address: values.address,
            contact: values.contact,
            bic: values.bic,
            swift: values.swift,
          }),
        }),
      fallbackMessage: "Не удалось создать провайдера реквизитов",
      parseData: async (response) =>
        (await response.json()) as CreatedRequisiteProvider,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Провайдер реквизитов создан");
    router.push(`/entities/requisite-providers/${result.data.id}`);
  }

  return (
    <RequisiteProviderForm
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      submitLabel="Создать"
      submittingLabel="Создание..."
    />
  );
}
