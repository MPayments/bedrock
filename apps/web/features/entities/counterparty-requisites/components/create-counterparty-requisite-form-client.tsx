"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@multihansa/ui/components/sonner";

import { RequisiteGeneralForm } from "@/features/entities/requisites-shared/components/requisite-general-form";
import type { RequisiteFormValues } from "@/features/entities/requisites-shared/lib/constants";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type { CounterpartyRequisiteFormOptions } from "../lib/types";

type CreatedCounterpartyRequisite = {
  id: string;
};

type CreateCounterpartyRequisiteFormClientProps = {
  options: CounterpartyRequisiteFormOptions;
  initialValues?: Partial<RequisiteFormValues>;
  ownerReadonly?: boolean;
};

export function CreateCounterpartyRequisiteFormClient({
  options,
  initialValues,
  ownerReadonly = false,
}: CreateCounterpartyRequisiteFormClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: RequisiteFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedCounterpartyRequisite>({
      request: () =>
        apiClient.v1.requisites.$post({
          json: {
            ownerType: "counterparty",
            ownerId: values.ownerId,
            providerId: values.providerId,
            currencyId: values.currencyId,
            kind: values.kind,
            label: values.label,
            description: values.description || null,
            beneficiaryName: values.beneficiaryName || null,
            institutionName: values.institutionName || null,
            institutionCountry: values.institutionCountry || null,
            accountNo: values.accountNo || null,
            corrAccount: values.corrAccount || null,
            iban: values.iban || null,
            bic: values.bic || null,
            swift: values.swift || null,
            bankAddress: values.bankAddress || null,
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
      fallbackMessage: "Не удалось создать реквизит контрагента",
      parseData: async (response) =>
        (await response.json()) as CreatedCounterpartyRequisite,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Реквизит контрагента создан");
    router.push(`/entities/requisites/${result.data.id}`);
  }

  return (
    <RequisiteGeneralForm
      ownerLabel="Контрагент"
      ownerDescription="Выберите контрагента, для которого сохраняются реквизиты."
      ownerOptions={options.owners}
      providerOptions={options.providers}
      currencyOptions={options.currencies}
      initialValues={initialValues}
      ownerReadonly={ownerReadonly}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      submitLabel="Создать"
      submittingLabel="Создание..."
    />
  );
}
