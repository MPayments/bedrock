"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/ui/components/sonner";

import { RequisiteGeneralForm } from "@/features/entities/requisites-shared/components/requisite-general-form";
import type { RequisiteFormValues } from "@/features/entities/requisites-shared/lib/constants";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type {
  OrganizationRequisiteDetails,
  OrganizationRequisiteFormOptions,
} from "../lib/types";

type EditOrganizationRequisiteFormClientProps = {
  requisite: OrganizationRequisiteDetails;
  options: OrganizationRequisiteFormOptions;
};

export function EditOrganizationRequisiteFormClient({
  requisite,
  options,
}: EditOrganizationRequisiteFormClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(requisite);

  async function handleSubmit(
    values: RequisiteFormValues,
  ): Promise<RequisiteFormValues | void> {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<OrganizationRequisiteDetails>({
      request: () =>
        apiClient.v1["organization-requisites"][":id"].$patch({
          param: { id: current.id },
          json: {
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
      fallbackMessage: "Не удалось обновить реквизит организации",
      parseData: async (response) => {
        const payload = (await response.json()) as {
          id: string;
          organizationId: string;
          currencyId: string;
          kind: RequisiteFormValues["kind"];
          label: string;
          description: string | null;
          beneficiaryName: string | null;
          institutionName: string | null;
          institutionCountry: string | null;
          accountNo: string | null;
          corrAccount: string | null;
          iban: string | null;
          bic: string | null;
          swift: string | null;
          bankAddress: string | null;
          network: string | null;
          assetCode: string | null;
          address: string | null;
          memoTag: string | null;
          accountRef: string | null;
          subaccountRef: string | null;
          contact: string | null;
          notes: string | null;
          isDefault: boolean;
          createdAt: string;
          updatedAt: string;
        };

        return {
          id: payload.id,
          ownerId: payload.organizationId,
          currencyId: payload.currencyId,
          kind: payload.kind,
          label: payload.label,
          description: payload.description ?? "",
          beneficiaryName: payload.beneficiaryName ?? "",
          institutionName: payload.institutionName ?? "",
          institutionCountry: payload.institutionCountry ?? "",
          accountNo: payload.accountNo ?? "",
          corrAccount: payload.corrAccount ?? "",
          iban: payload.iban ?? "",
          bic: payload.bic ?? "",
          swift: payload.swift ?? "",
          bankAddress: payload.bankAddress ?? "",
          network: payload.network ?? "",
          assetCode: payload.assetCode ?? "",
          address: payload.address ?? "",
          memoTag: payload.memoTag ?? "",
          accountRef: payload.accountRef ?? "",
          subaccountRef: payload.subaccountRef ?? "",
          contact: payload.contact ?? "",
          notes: payload.notes ?? "",
          isDefault: payload.isDefault,
          createdAt: payload.createdAt,
          updatedAt: payload.updatedAt,
        };
      },
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    setCurrent(result.data);
    toast.success("Реквизит организации обновлён");
    router.refresh();
    return result.data;
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1["organization-requisites"][":id"].$delete({
          param: { id: current.id },
        }),
      fallbackMessage: "Не удалось удалить реквизит организации",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    toast.success("Реквизит организации удалён");
    router.push("/entities/organization-requisites");
    return true;
  }

  return (
    <RequisiteGeneralForm
      ownerLabel="Организация"
      ownerDescription="Внутренняя организация-владелец."
      ownerOptions={options.owners}
      currencyOptions={options.currencies}
      initialValues={current}
      createdAt={current.createdAt}
      updatedAt={current.updatedAt}
      ownerReadonly
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
