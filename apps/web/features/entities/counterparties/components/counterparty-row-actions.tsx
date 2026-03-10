"use client";

import { useRouter } from "next/navigation";

import { EntityRowActions } from "@/components/entities/entity-row-actions";
import { apiClient } from "@/lib/api-client";

type CounterpartyRowActionModel = {
  id: string;
  shortName: string;
};

type CounterpartyRowActionsProps = {
  counterparty: CounterpartyRowActionModel;
  detailsBasePath?: string;
};

export function CounterpartyRowActions({
  counterparty,
  detailsBasePath = "/entities/parties/counterparties",
}: CounterpartyRowActionsProps) {
  const router = useRouter();

  return (
    <EntityRowActions
      openHref={`${detailsBasePath.replace(/\/+$/, "")}/${counterparty.id}`}
      ariaLabel={`Действия для контрагента ${counterparty.shortName}`}
      deleteDialogTitle="Удалить контрагента?"
      deleteDialogDescription="Контрагент будет удален без возможности восстановления."
      deleteFallbackMessage="Не удалось удалить контрагента"
      deleteSuccessMessage="Контрагент удален"
      deleteRequest={() =>
        apiClient.v1.parties.counterparties[":id"].$delete({
          param: { id: counterparty.id },
        })
      }
      onDeleted={() => {
        router.refresh();
      }}
    />
  );
}
