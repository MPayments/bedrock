"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@multihansa/ui/components/sonner";

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
        apiClient.v1["requisite-providers"].$post({
          json: {
            kind: values.kind,
            name: values.name,
            description: values.description || undefined,
            country: values.country || undefined,
            address: values.address || undefined,
            contact: values.contact || undefined,
            bic: values.bic || undefined,
            swift: values.swift || undefined,
          },
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
