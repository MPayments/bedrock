"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { RequisiteProviderMasterDataEditor } from "@bedrock/sdk-parties-ui/components/requisite-provider-master-data-editor";
import {
  createEmptyRequisiteProviderMasterDataSource,
  type RequisiteProviderMasterDataInput,
} from "@bedrock/sdk-parties-ui/lib/requisite-provider-master-data";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type CreatedRequisiteProvider = {
  id: string;
};

const EMPTY_PROVIDER = createEmptyRequisiteProviderMasterDataSource();

export function CreateRequisiteProviderFormClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: RequisiteProviderMasterDataInput) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedRequisiteProvider>({
      request: () =>
        apiClient.v1.requisites.providers.$post({
          json: values,
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

    return values;
  }

  return (
    <RequisiteProviderMasterDataEditor
      provider={EMPTY_PROVIDER}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      submitLabel="Создать провайдера"
      submittingLabel="Создание..."
    />
  );
}
