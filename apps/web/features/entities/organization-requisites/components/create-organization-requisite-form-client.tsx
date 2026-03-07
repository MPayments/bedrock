"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import { RequisiteGeneralForm } from "@/features/entities/requisites-shared/components/requisite-general-form";
import type { RequisiteFormValues } from "@/features/entities/requisites-shared/lib/constants";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type { OrganizationRequisiteFormOptions } from "../lib/types";

type CreatedOrganizationRequisite = {
  id: string;
};

type CreateOrganizationRequisiteFormClientProps = {
  options: OrganizationRequisiteFormOptions;
  initialValues?: Partial<RequisiteFormValues>;
};

export function CreateOrganizationRequisiteFormClient({
  options,
  initialValues,
}: CreateOrganizationRequisiteFormClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: RequisiteFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedOrganizationRequisite>({
      request: () =>
        apiClient.v1["organization-requisites"].$post({
          json: {
            organizationId: values.ownerId,
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
      fallbackMessage: "Не удалось создать реквизит организации",
      parseData: async (response) =>
        (await response.json()) as CreatedOrganizationRequisite,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Реквизит организации создан");
    router.push(`/entities/organization-requisites/${result.data.id}`);
  }

  return (
    <RequisiteGeneralForm
      ownerLabel="Организация"
      ownerDescription="Внутренняя организация, для которой хранится расчётный реквизит."
      ownerOptions={options.owners}
      currencyOptions={options.currencies}
      initialValues={initialValues}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      submitLabel="Создать"
      submittingLabel="Создание..."
    />
  );
}
