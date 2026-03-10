"use client";

import { useRouter } from "next/navigation";

import { EntityRowActions } from "@/components/entities/entity-row-actions";
import { apiClient } from "@/lib/api-client";

type CounterpartyRequisiteRowActionModel = {
  id: string;
  label: string;
};

type CounterpartyRequisiteRowActionsProps = {
  requisite: CounterpartyRequisiteRowActionModel;
};

export function CounterpartyRequisiteRowActions({
  requisite,
}: CounterpartyRequisiteRowActionsProps) {
  const router = useRouter();

  return (
    <EntityRowActions
      openHref={`/entities/parties/requisites/${requisite.id}`}
      ariaLabel={`Действия для реквизита ${requisite.label}`}
      deleteDialogTitle="Удалить реквизит контрагента?"
      deleteDialogDescription="Реквизит будет удалён без возможности восстановления."
      deleteFallbackMessage="Не удалось удалить реквизит контрагента"
      deleteSuccessMessage="Реквизит контрагента удалён"
      deleteRequest={() =>
        apiClient.v1.parties.requisites[":id"].$delete({
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
