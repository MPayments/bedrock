"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  RequisiteProviderForm,
  type RequisiteProviderFormValues,
} from "./requisite-provider-form";
import type { SerializedRequisiteProvider } from "../lib/types";

type EditRequisiteProviderFormClientProps = {
  provider: SerializedRequisiteProvider;
};

export function EditRequisiteProviderFormClient({
  provider,
}: EditRequisiteProviderFormClientProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(provider);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    values: RequisiteProviderFormValues,
  ): Promise<RequisiteProviderFormValues | void> {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<SerializedRequisiteProvider>({
      request: () =>
        apiClient.v1["requisite-providers"][":id"].$patch({
          param: { id: current.id },
          json: {
            kind: values.kind,
            name: values.name,
            description: values.description || null,
            country: values.country || null,
            address: values.address || null,
            contact: values.contact || null,
            bic: values.bic || null,
            swift: values.swift || null,
          },
        }),
      fallbackMessage: "Не удалось обновить провайдера реквизитов",
      parseData: async (response) =>
        (await response.json()) as SerializedRequisiteProvider,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    setCurrent(result.data);
    toast.success("Провайдер реквизитов обновлён");
    router.refresh();

    return {
      kind: result.data.kind,
      name: result.data.name,
      description: result.data.description ?? "",
      country: result.data.country ?? "",
      address: result.data.address ?? "",
      contact: result.data.contact ?? "",
      bic: result.data.bic ?? "",
      swift: result.data.swift ?? "",
    };
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1["requisite-providers"][":id"].$delete({
          param: { id: current.id },
        }),
      fallbackMessage: "Не удалось удалить провайдера реквизитов",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    toast.success("Провайдер реквизитов удалён");
    router.push("/entities/requisite-providers");
    return true;
  }

  return (
    <RequisiteProviderForm
      initialValues={{
        kind: current.kind,
        name: current.name,
        description: current.description ?? "",
        country: current.country ?? "",
        address: current.address ?? "",
        contact: current.contact ?? "",
        bic: current.bic ?? "",
        swift: current.swift ?? "",
      }}
      createdAt={current.createdAt}
      updatedAt={current.updatedAt}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      submitLabel="Сохранить"
      submittingLabel="Сохранение..."
      showDelete
    />
  );
}
