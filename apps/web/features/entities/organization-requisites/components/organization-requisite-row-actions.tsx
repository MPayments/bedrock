"use client";

import { useRouter } from "next/navigation";

import { EntityRowActions } from "@/components/entities/entity-row-actions";
import { apiClient } from "@/lib/api-client";

type OrganizationRequisiteRowActionModel = {
  id: string;
  label: string;
};

type OrganizationRequisiteRowActionsProps = {
  requisite: OrganizationRequisiteRowActionModel;
};

export function OrganizationRequisiteRowActions({
  requisite,
}: OrganizationRequisiteRowActionsProps) {
  const router = useRouter();

  return (
    <EntityRowActions
      openHref={`/entities/organization-requisites/${requisite.id}`}
      ariaLabel={`Действия для реквизита ${requisite.label}`}
      deleteDialogTitle="Удалить реквизит организации?"
      deleteDialogDescription="Реквизит организации будет удалён без возможности восстановления."
      deleteFallbackMessage="Не удалось удалить реквизит организации"
      deleteSuccessMessage="Реквизит организации удалён"
      deleteRequest={() =>
        apiClient.v1["organization-requisites"][":id"].$delete({
          param: { id: requisite.id },
        })
      }
      onDeleted={() => {
        router.refresh();
      }}
      stopRowDoubleClick
    />
  );
}
