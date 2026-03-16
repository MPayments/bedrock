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

type CreatedOrganization = {
  id: string;
};

type CreateOrganizationFormClientProps = {
  detailsBasePath?: string;
};

export function CreateOrganizationFormClient({
  detailsBasePath = "/entities/organizations",
}: CreateOrganizationFormClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: OrganizationFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedOrganization>({
      request: () =>
        apiClient.v1.organizations.$post({
          json: {
            shortName: values.shortName,
            fullName: values.fullName,
            kind: values.kind,
            country: values.country || undefined,
            externalId: values.externalId || undefined,
            description: values.description || undefined,
          },
        }),
      fallbackMessage: "Не удалось создать организацию",
      parseData: async (response) => (await response.json()) as CreatedOrganization,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Организация создана");
    router.push(`${detailsBasePath.replace(/\/+$/, "")}/${result.data.id}`);
  }

  return (
    <OrganizationForm
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      submitLabel="Создать"
      submittingLabel="Создание..."
    />
  );
}
