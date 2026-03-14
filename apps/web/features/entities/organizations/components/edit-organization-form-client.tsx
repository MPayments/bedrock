"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  OrganizationForm,
  type OrganizationFormValues,
} from "./organization-form";
import type { SerializedOrganization } from "../lib/types";

type EditOrganizationFormClientProps = {
  organization: SerializedOrganization;
  listPath?: string;
};

export function EditOrganizationFormClient({
  organization,
  listPath = "/entities/organizations",
}: EditOrganizationFormClientProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(organization);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    values: OrganizationFormValues,
  ): Promise<OrganizationFormValues | void> {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<SerializedOrganization>({
      request: () =>
        apiClient.v1.organizations[":id"].$patch({
          param: { id: current.id },
          json: {
            shortName: values.shortName,
            fullName: values.fullName,
            kind: values.kind,
            country: values.country || null,
            externalId: values.externalId || null,
            description: values.description || null,
          },
        }),
      fallbackMessage: "Не удалось обновить организацию",
      parseData: async (response) => (await response.json()) as SerializedOrganization,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    setCurrent(result.data);
    toast.success("Организация обновлена");
    router.refresh();

    return {
      shortName: result.data.shortName,
      fullName: result.data.fullName,
      kind: result.data.kind,
      country: result.data.country ?? "",
      externalId: result.data.externalId ?? "",
      description: result.data.description ?? "",
    };
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.organizations[":id"].$delete({
          param: { id: current.id },
        }),
      fallbackMessage: "Не удалось удалить организацию",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    toast.success("Организация удалена");
    router.push(listPath.replace(/\/+$/, ""));
    return true;
  }

  return (
    <OrganizationForm
      initialValues={{
        shortName: current.shortName,
        fullName: current.fullName,
        kind: current.kind,
        country: current.country ?? "",
        externalId: current.externalId ?? "",
        description: current.description ?? "",
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
