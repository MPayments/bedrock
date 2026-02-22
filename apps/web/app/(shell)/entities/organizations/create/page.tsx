"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CreateOrganizationInputSchema } from "@bedrock/organizations";

import { OrganizationGeneralForm, type OrganizationGeneralFormValues } from "../components/organization-general-form";
import { useOrganizationCreateDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";

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

export default function CreateOrganizationPage() {
  const router = useRouter();
  const { setCreateName, resetCreateName } = useOrganizationCreateDraftName();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: OrganizationGeneralFormValues) {
    setError(null);

    const payload = {
      name: values.name.trim(),
      country: values.country.trim() || undefined,
      baseCurrency: values.baseCurrency,
      externalId: values.externalId.trim() || undefined,
      isTreasury: values.isTreasury,
      customerId: values.isTreasury ? undefined : values.customerId.trim() || undefined,
    };

    const parsed = CreateOrganizationInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Некорректные данные формы");
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiClient.v1.organizations.$post({
        json: parsed.data,
      });

      if (!res.ok) {
        let message = `Не удалось создать организацию (${res.status})`;
        try {
          const body = await res.json();
          const extracted = extractErrorMessage(body);
          if (extracted) message = extracted;
        } catch {}

        setError(message);
        return;
      }

      const created = await res.json();
      resetCreateName();
      router.push(`/entities/organizations/${created.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать организацию";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OrganizationGeneralForm
      mode="create"
      initialValues={{
        name: "",
        country: "",
        baseCurrency: "USD",
        externalId: "",
        isTreasury: true,
        customerId: "",
      }}
      submitting={submitting}
      error={error}
      onNameChange={setCreateName}
      onSubmit={handleSubmit}
    />
  );
}
