import { Wallet } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { CreateCounterpartyRequisiteFormClient } from "@/features/entities/counterparty-requisites/components/create-counterparty-requisite-form-client";
import { getCounterpartyRequisiteFormOptions } from "@/features/entities/counterparty-requisites/lib/queries";

interface CreateCounterpartyRequisitePageProps {
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

export default async function CreateCounterpartyRequisitePage({
  searchParams,
}: CreateCounterpartyRequisitePageProps) {
  const [params, options] = await Promise.all([
    searchParams,
    getCounterpartyRequisiteFormOptions(),
  ]);
  const counterpartyId = readSingleSearchValue(params.counterpartyId);

  return (
    <EntityWorkspaceLayout
      title="Новый реквизит контрагента"
      subtitle="Карточка реквизита"
      icon={Wallet}
    >
      <CreateCounterpartyRequisiteFormClient
        options={options}
        initialValues={counterpartyId ? { ownerId: counterpartyId } : undefined}
        ownerReadonly={Boolean(counterpartyId)}
      />
    </EntityWorkspaceLayout>
  );
}
