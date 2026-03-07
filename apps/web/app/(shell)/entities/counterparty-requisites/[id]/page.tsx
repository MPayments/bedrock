import { Wallet } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { EditCounterpartyRequisiteFormClient } from "@/features/entities/counterparty-requisites/components/edit-counterparty-requisite-form-client";
import {
  getCounterpartyRequisiteById,
  getCounterpartyRequisiteFormOptions,
} from "@/features/entities/counterparty-requisites/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface CounterpartyRequisitePageProps {
  params: Promise<{ id: string }>;
}

export default async function CounterpartyRequisitePage({
  params,
}: CounterpartyRequisitePageProps) {
  const [{ entity: requisite }, options] = await Promise.all([
    loadResourceByIdParamOrNotFound({
      params,
      getById: getCounterpartyRequisiteById,
    }),
    getCounterpartyRequisiteFormOptions(),
  ]);

  return (
    <EntityWorkspaceLayout
      title={requisite.label}
      subtitle="Карточка реквизита контрагента"
      icon={Wallet}
    >
      <EditCounterpartyRequisiteFormClient
        requisite={requisite}
        options={options}
      />
    </EntityWorkspaceLayout>
  );
}
