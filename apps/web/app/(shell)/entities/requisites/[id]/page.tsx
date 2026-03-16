import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { EditCounterpartyRequisiteFormClient } from "@/features/entities/counterparty-requisites/components/edit-counterparty-requisite-form-client";
import {
  getCounterpartyRequisiteById,
  getCounterpartyRequisiteFormOptions,
} from "@/features/entities/counterparty-requisites/lib/queries";
import { EditOrganizationRequisiteFormClient } from "@/features/entities/organization-requisites/components/edit-organization-requisite-form-client";
import {
  getOrganizationRequisiteById,
  getOrganizationRequisiteFormOptions,
} from "@/features/entities/organization-requisites/lib/queries";
import { getRequisiteById } from "@/features/entities/requisites/lib/queries";

interface RequisitePageProps {
  params: Promise<{ id: string }>;
}

export default async function RequisitePage({ params }: RequisitePageProps) {
  const { id } = await params;
  const requisite = await getRequisiteById(id);

  if (!requisite) {
    notFound();
  }

  if (requisite.ownerType === "counterparty") {
    const [counterpartyRequisite, options] = await Promise.all([
      getCounterpartyRequisiteById(id),
      getCounterpartyRequisiteFormOptions(),
    ]);

    if (!counterpartyRequisite) {
      notFound();
    }

    return (
      <EntityWorkspaceLayout
        title={counterpartyRequisite.label}
        subtitle="Карточка реквизита"
        icon={Wallet}
      >
        <EditCounterpartyRequisiteFormClient
          requisite={counterpartyRequisite}
          options={options}
        />
      </EntityWorkspaceLayout>
    );
  }

  const [organizationRequisite, options] = await Promise.all([
    getOrganizationRequisiteById(id),
    getOrganizationRequisiteFormOptions(),
  ]);

  if (!organizationRequisite) {
    notFound();
  }

  return (
    <EntityWorkspaceLayout
      title={organizationRequisite.label}
      subtitle="Карточка реквизита"
      icon={Wallet}
    >
      <EditOrganizationRequisiteFormClient
        requisite={organizationRequisite}
        options={options}
      />
    </EntityWorkspaceLayout>
  );
}
