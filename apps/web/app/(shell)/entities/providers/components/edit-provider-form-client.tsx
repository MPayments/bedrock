"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import {
  ProviderEditGeneralForm,
  type ProviderGeneralFormValues,
} from "./provider-general-form";
import { useProviderDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import type { ProviderDetails } from "../lib/queries";
import { executeMutation } from "@/lib/resources/http";

function toFormValues(provider: ProviderDetails): ProviderGeneralFormValues {
  return {
    name: provider.name,
    description: provider.description ?? "",
    type: provider.type as ProviderGeneralFormValues["type"],
    country: provider.country,
    address: provider.address ?? "",
    contact: provider.contact ?? "",
    bic: provider.bic ?? "",
    swift: provider.swift ?? "",
  };
}

type EditProviderFormClientProps = {
  provider: ProviderDetails;
};

export function EditProviderFormClient({ provider }: EditProviderFormClientProps) {
  const router = useRouter();
  const { actions } = useProviderDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState(() => toFormValues(provider));
  const [createdAt, setCreatedAt] = useState<string | null>(provider.createdAt);
  const [updatedAt, setUpdatedAt] = useState<string | null>(provider.updatedAt);

  const handleNameChange = useCallback(
    (name: string) => {
      actions.setEditName(provider.id, name);
    },
    [actions, provider.id],
  );

  async function handleSubmit(
    values: ProviderGeneralFormValues,
  ): Promise<ProviderGeneralFormValues | void> {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<ProviderDetails>({
      request: () =>
        apiClient.v1["account-providers"][":id"].$patch({
          param: { id: provider.id },
          json: {
            name: values.name,
            description: values.description || null,
            country: values.country,
            address: values.address || null,
            contact: values.contact || null,
            bic: values.bic || null,
            swift: values.swift || null,
          },
        }),
      fallbackMessage: "Не удалось обновить провайдера",
      parseData: async (response) => (await response.json()) as ProviderDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    const nextValues = toFormValues(result.data);
    setInitialValues(nextValues);
    setCreatedAt(result.data.createdAt);
    setUpdatedAt(result.data.updatedAt);
    toast.success("Провайдер обновлён");
    router.refresh();
    return nextValues;
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1["account-providers"][":id"].$delete({
          param: { id: provider.id },
        }),
      fallbackMessage: "Не удалось удалить провайдера",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    actions.clearEdit(provider.id);
    router.push("/entities/providers");
    return true;
  }

  return (
    <ProviderEditGeneralForm
      initialValues={initialValues}
      createdAt={createdAt}
      updatedAt={updatedAt}
      submitting={submitting}
      deleting={deleting}
      error={error}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onNameChange={handleNameChange}
    />
  );
}
