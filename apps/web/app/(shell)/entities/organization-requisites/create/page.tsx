import { Wallet } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { CreateOrganizationRequisiteFormClient } from "@/features/entities/organization-requisites/components/create-organization-requisite-form-client";
import { getOrganizationRequisiteFormOptions } from "@/features/entities/organization-requisites/lib/queries";

export default async function CreateOrganizationRequisitePage() {
  const options = await getOrganizationRequisiteFormOptions();

  return (
    <EntityWorkspaceLayout
      title="Новый реквизит организации"
      subtitle="Карточка реквизита"
      icon={Wallet}
    >
      <CreateOrganizationRequisiteFormClient options={options} />
    </EntityWorkspaceLayout>
  );
}
