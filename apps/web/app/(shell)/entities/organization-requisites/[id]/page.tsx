import { Wallet } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { EditOrganizationRequisiteFormClient } from "@/features/entities/organization-requisites/components/edit-organization-requisite-form-client";
import {
  getOrganizationRequisiteById,
  getOrganizationRequisiteFormOptions,
} from "@/features/entities/organization-requisites/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface OrganizationRequisitePageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationRequisitePage({
  params,
}: OrganizationRequisitePageProps) {
  const [{ entity: requisite }, options] = await Promise.all([
    loadResourceByIdParamOrNotFound({
      params,
      getById: getOrganizationRequisiteById,
    }),
    getOrganizationRequisiteFormOptions(),
  ]);

  return (
    <EntityWorkspaceLayout
      title={requisite.label}
      subtitle="Карточка реквизита организации"
      icon={Wallet}
    >
      <EditOrganizationRequisiteFormClient
        requisite={requisite}
        options={options}
      />
    </EntityWorkspaceLayout>
  );
}
