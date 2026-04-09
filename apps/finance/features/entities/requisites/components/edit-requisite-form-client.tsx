"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { RequisiteProviderSchema } from "@bedrock/parties/contracts";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { z } from "zod";

import { RequisiteGeneralForm } from "@/features/entities/requisites-shared/components/requisite-general-form";
import type { RequisiteFormValues } from "@/features/entities/requisites-shared/lib/constants";
import {
  buildRequisiteIdentifiers,
  toLegacyRequisiteValues,
} from "@/features/entities/requisites-shared/lib/master-data";
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
  organizationId: string | null;
  counterpartyId: string | null;
  providerId: string;
  providerBranchId: string | null;
  currencyId: string;
  kind: RequisiteFormValues["kind"];
  label: string;
  beneficiaryName: string | null;
  beneficiaryNameLocal: string | null;
  beneficiaryAddress: string | null;
  paymentPurposeTemplate: string | null;
  notes: string | null;
  identifiers: Array<{
    scheme: string;
    value: string;
    isPrimary: boolean;
  }>;
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
    providerBranchId: requisite.providerBranchId,
    currencyId: requisite.currencyId,
    kind: requisite.kind,
    label: requisite.label,
    description: requisite.description,
    beneficiaryName: requisite.beneficiaryName,
    beneficiaryNameLocal: requisite.beneficiaryNameLocal,
    beneficiaryAddress: requisite.beneficiaryAddress,
    accountNo: requisite.accountNo,
    corrAccount: requisite.corrAccount,
    iban: requisite.iban,
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
  const legacyValues = toLegacyRequisiteValues({
    kind: payload.kind,
    beneficiaryName: payload.beneficiaryName,
    beneficiaryNameLocal: payload.beneficiaryNameLocal,
    beneficiaryAddress: payload.beneficiaryAddress,
    paymentPurposeTemplate: payload.paymentPurposeTemplate,
    notes: payload.notes,
    identifiers: payload.identifiers,
  });

  return {
    id: payload.id,
    ownerType,
    ownerId: payload.ownerId,
    providerId: payload.providerId,
    providerBranchId: payload.providerBranchId ?? "",
    currencyId: payload.currencyId,
    kind: payload.kind,
    label: payload.label,
    description: legacyValues.description,
    beneficiaryName: legacyValues.beneficiaryName,
    beneficiaryNameLocal: legacyValues.beneficiaryNameLocal,
    beneficiaryAddress: legacyValues.beneficiaryAddress,
    accountNo: legacyValues.accountNo,
    corrAccount: legacyValues.corrAccount,
    iban: legacyValues.iban,
    network: legacyValues.network,
    assetCode: legacyValues.assetCode,
    address: legacyValues.address,
    memoTag: legacyValues.memoTag,
    accountRef: legacyValues.accountRef,
    subaccountRef: legacyValues.subaccountRef,
    contact: legacyValues.contact,
    notes: legacyValues.notes,
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

  async function loadProviderBranches(providerId: string) {
    const response = await apiClient.v1.requisites.providers[":id"].$get({
      param: { id: providerId },
    });

    if (!response.ok) {
      return [];
    }

    const provider = RequisiteProviderSchema.omit({
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
    })
      .extend({
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
        archivedAt: z.iso.datetime().nullable(),
      })
      .parse(await response.json());

    return provider.branches.map((branch) => ({
      id: branch.id,
      label: branch.name,
    }));
  }

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
            providerBranchId: values.providerBranchId || null,
            currencyId: values.currencyId,
            kind: values.kind,
            label: values.label,
            beneficiaryName: values.beneficiaryName || null,
            beneficiaryNameLocal: values.beneficiaryNameLocal || null,
            beneficiaryAddress: values.beneficiaryAddress || null,
            paymentPurposeTemplate: values.description || null,
            notes: values.notes || null,
            identifiers: buildRequisiteIdentifiers(values),
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
      loadProviderBranches={loadProviderBranches}
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
