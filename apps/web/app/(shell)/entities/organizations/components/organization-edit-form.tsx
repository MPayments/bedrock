"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { UpdateOrganizationInputSchema } from "@bedrock/organizations/validation";

import {
  OrganizationEditGeneralForm,
  type OrganizationGeneralFormValues,
} from "./organization-general-form";
import { apiClient } from "@/lib/api-client";

type OrganizationEditFormProps = {
  organization: {
    id: string;
    externalId: string | null;
    customerId: string | null;
    name: string;
    country: string | null;
    baseCurrency: string;
    isTreasury: boolean;
  };
};

function toFormValues(
  organization: OrganizationEditFormProps["organization"],
): OrganizationGeneralFormValues {
  return {
    name: organization.name,
    country: organization.country ?? "",
    baseCurrency: organization.baseCurrency,
    externalId: organization.externalId ?? "",
    isTreasury: organization.isTreasury,
    customerId: organization.customerId ?? "",
  };
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  if ("error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return null;
}

export function OrganizationEditForm({
  organization,
}: OrganizationEditFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialValues, setInitialValues] =
    useState<OrganizationGeneralFormValues>(() => toFormValues(organization));

  async function handleSubmit(
    values: OrganizationGeneralFormValues,
  ): Promise<OrganizationGeneralFormValues | void> {
    setError(null);

    const payload = {
      name: values.name.trim(),
      country: values.country.trim() || null,
      baseCurrency: values.baseCurrency,
      externalId: values.externalId.trim() || null,
    };

    const parsed = UpdateOrganizationInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Некорректные данные формы");
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiClient.v1.organizations[":id"].$patch({
        param: {
          id: organization.id,
        },
        json: parsed.data,
      });

      if (!res.ok) {
        let message = `Не удалось обновить организацию (${res.status})`;
        try {
          const body = await res.json();
          const extracted = extractErrorMessage(body);
          if (extracted) message = extracted;
        } catch {
          // Ignore non-JSON error payloads.
        }

        setError(message);
        return;
      }

      const updated = await res.json();
      const nextValues = toFormValues(updated);
      setInitialValues(nextValues);
      router.refresh();
      return nextValues;
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось обновить организацию";
      setError(message);
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OrganizationEditGeneralForm
      initialValues={initialValues}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
