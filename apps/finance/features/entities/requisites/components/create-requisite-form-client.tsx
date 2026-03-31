"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { RequisiteGeneralForm } from "@/features/entities/requisites-shared/components/requisite-general-form";
import type {
  RequisiteFormValues,
  RequisiteOwnerType,
} from "@/features/entities/requisites-shared/lib/constants";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  getRequisiteOwnerOptions,
  getRequisiteOwnerPresentation,
} from "../lib/owner-config";
import type { RequisiteFormOptions } from "../lib/types";

type CreatedRequisite = {
  id: string;
};

type CreateRequisiteFormClientProps = {
  options: RequisiteFormOptions;
  initialOwnerType?: RequisiteOwnerType;
  initialValues?: Partial<RequisiteFormValues>;
  ownerReadonly?: boolean;
  ownerTypeReadonly?: boolean;
};

export function CreateRequisiteFormClient({
  options,
  initialOwnerType,
  initialValues,
  ownerReadonly = false,
  ownerTypeReadonly = false,
}: CreateRequisiteFormClientProps) {
  const router = useRouter();
  const [ownerType, setOwnerType] = useState<RequisiteOwnerType | undefined>(
    initialOwnerType,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerOptions = getRequisiteOwnerOptions(options, ownerType);
  const ownerPresentation = getRequisiteOwnerPresentation(ownerType);

  async function handleSubmit(values: RequisiteFormValues) {
    if (!ownerType) {
      return;
    }

    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedRequisite>({
      request: () =>
        apiClient.v1.requisites.$post({
          json: {
            ownerType,
            ownerId: values.ownerId,
            providerId: values.providerId,
            currencyId: values.currencyId,
            kind: values.kind,
            label: values.label,
            description: values.description || null,
            beneficiaryName: values.beneficiaryName || null,
            accountNo: values.accountNo || null,
            corrAccount: values.corrAccount || null,
            iban: values.iban || null,
            network: values.network || null,
            assetCode: values.assetCode || null,
            address: values.address || null,
            memoTag: values.memoTag || null,
            accountRef: values.accountRef || null,
            subaccountRef: values.subaccountRef || null,
            contact: values.contact || null,
            notes: values.notes || null,
            isDefault: values.isDefault,
          },
        }),
      fallbackMessage: "Не удалось создать реквизит",
      parseData: async (response) => (await response.json()) as CreatedRequisite,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Реквизит создан");
    router.push(`/entities/requisites/${result.data.id}`);
  }

  return (
    <RequisiteGeneralForm
      ownerType={ownerType}
      ownerLabel={ownerPresentation.ownerLabel}
      ownerDescription={ownerPresentation.ownerDescription}
      ownerOptions={ownerOptions}
      ownerTypeReadonly={ownerTypeReadonly}
      providerOptions={options.providers}
      currencyOptions={options.currencies}
      initialValues={initialValues}
      ownerReadonly={ownerReadonly}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onOwnerTypeChange={setOwnerType}
      submitLabel="Создать"
      submittingLabel="Создание..."
    />
  );
}
