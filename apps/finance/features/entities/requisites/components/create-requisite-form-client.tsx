"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { RequisiteProviderSchema } from "@bedrock/parties/contracts";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { z } from "zod";

import { RequisiteGeneralForm } from "@/features/entities/requisites-shared/components/requisite-general-form";
import type {
  RequisiteFormValues,
  RequisiteOwnerType,
} from "@/features/entities/requisites-shared/lib/constants";
import { buildRequisiteIdentifiers } from "@/features/entities/requisites-shared/lib/master-data";
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

  async function handleSubmit(values: RequisiteFormValues) {
    if (!ownerType) {
      return;
    }

    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedRequisite>({
      request: () => {
        const json = {
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
        };

        return ownerType === "organization"
          ? apiClient.v1.organizations[":id"].requisites.$post({
              param: { id: values.ownerId },
              json,
            })
          : apiClient.v1.counterparties[":id"].requisites.$post({
              param: { id: values.ownerId },
              json,
            });
      },
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
      loadProviderBranches={loadProviderBranches}
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
