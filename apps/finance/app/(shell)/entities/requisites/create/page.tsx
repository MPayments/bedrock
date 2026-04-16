import React from "react";

import { CreateRequisiteFormClient } from "@/features/entities/requisites/components/create-requisite-form-client";
import { RequisiteWorkspaceLayout } from "@/features/entities/requisites/components/requisite-workspace-layout";
import { getRequisiteFormOptions } from "@/features/entities/requisites/lib/queries";
import type { RequisiteOwnerType } from "@/features/entities/requisites-shared/lib/constants";

interface CreateRequisitePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readSingleSearchValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  if (Array.isArray(value) && value.length > 0) {
    const normalized = value[0]?.trim();
    return normalized ? normalized : undefined;
  }

  return undefined;
}

export default async function CreateRequisitePage({
  searchParams,
}: CreateRequisitePageProps) {
  const params = await searchParams;
  const ownerTypeValue = readSingleSearchValue(params.ownerType);
  const ownerId = readSingleSearchValue(params.ownerId);
  const currencyId = readSingleSearchValue(params.currencyId);
  const ownerType: RequisiteOwnerType | undefined =
    ownerTypeValue === "counterparty" || ownerTypeValue === "organization"
      ? ownerTypeValue
      : undefined;
  const options = await getRequisiteFormOptions();

  return (
    <RequisiteWorkspaceLayout title="Новый реквизит">
      <CreateRequisiteFormClient
        options={options}
        initialOwnerType={ownerType}
        initialValues={
          ownerType && ownerId
            ? {
                currencyId,
                ownerId,
              }
            : undefined
        }
        ownerReadonly={Boolean(ownerType && ownerId)}
        ownerTypeReadonly={Boolean(ownerType && ownerId)}
      />
    </RequisiteWorkspaceLayout>
  );
}
