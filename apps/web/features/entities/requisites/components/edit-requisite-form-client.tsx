"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { RequisiteGeneralForm } from "@/features/entities/requisites-shared/components/requisite-general-form";
import type { RequisiteFormValues } from "@/features/entities/requisites-shared/lib/constants";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  getRequisiteOwnerOptions,
  getRequisiteOwnerPresentation,
} from "../lib/owner-config";
import type {
  RequisiteDetailsWithOwnerType,
  RequisiteFormOptions,
} from "../lib/types";

type EditRequisiteFormClientProps = {
  requisite: RequisiteDetailsWithOwnerType;
  options: RequisiteFormOptions;
  listPath?: string;
};

type UpdatedRequisiteResponse = {
  id: string;
  ownerId: string;
  providerId: string;
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

function toFormValues(
  requisite: RequisiteDetailsWithOwnerType,
): RequisiteFormValues {
  return {
    ownerId: requisite.ownerId,
    providerId: requisite.providerId,
    currencyId: requisite.currencyId,
    kind: requisite.kind,
    label: requisite.label,
    description: requisite.description,
    beneficiaryName: requisite.beneficiaryName,
    institutionName: requisite.institutionName,
    institutionCountry: requisite.institutionCountry,
    accountNo: requisite.accountNo,
    corrAccount: requisite.corrAccount,
    iban: requisite.iban,
    bic: requisite.bic,
    swift: requisite.swift,
    bankAddress: requisite.bankAddress,
    network: requisite.network,
    assetCode: requisite.assetCode,
    address: requisite.address,
    memoTag: requisite.memoTag,
    accountRef: requisite.accountRef,
    subaccountRef: requisite.subaccountRef,
    contact: requisite.contact,
    notes: requisite.notes,
    isDefault: requisite.isDefault,
  };
}

function toUpdatedRequisite(
  ownerType: RequisiteDetailsWithOwnerType["ownerType"],
  payload: UpdatedRequisiteResponse,
): RequisiteDetailsWithOwnerType {
  return {
    id: payload.id,
    ownerType,
    ownerId: payload.ownerId,
    providerId: payload.providerId,
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
}

export function EditRequisiteFormClient({
  requisite,
  options,
  listPath = "/entities/requisites",
}: EditRequisiteFormClientProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(requisite);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerOptions = getRequisiteOwnerOptions(options, current.ownerType);
  const ownerPresentation = getRequisiteOwnerPresentation(current.ownerType);

  async function handleSubmit(
    values: RequisiteFormValues,
  ): Promise<RequisiteFormValues | void> {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<RequisiteDetailsWithOwnerType>({
      request: () =>
        apiClient.v1.requisites[":id"].$patch({
          param: { id: current.id },
          json: {
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
      fallbackMessage: "Не удалось обновить реквизит",
      parseData: async (response) =>
        toUpdatedRequisite(
          current.ownerType,
          (await response.json()) as UpdatedRequisiteResponse,
        ),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    setCurrent(result.data);
    toast.success("Реквизит обновлён");
    router.refresh();

    return toFormValues(result.data);
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.requisites[":id"].$delete({
          param: { id: current.id },
        }),
      fallbackMessage: "Не удалось удалить реквизит",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    toast.success("Реквизит удалён");
    router.push(listPath.replace(/\/+$/, ""));
    return true;
  }

  return (
    <RequisiteGeneralForm
      ownerType={current.ownerType}
      ownerLabel={ownerPresentation.ownerLabel}
      ownerDescription={ownerPresentation.ownerDescription}
      ownerOptions={ownerOptions}
      ownerTypeReadonly
      providerOptions={options.providers}
      currencyOptions={options.currencies}
      initialValues={toFormValues(current)}
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
