"use client";

import { useRouter } from "next/navigation";

import { EntityRowActions } from "@/components/entities/entity-row-actions";
import { apiClient } from "@/lib/api-client";

type AccountRowActionModel = {
  id: string;
  label: string;
};

type AccountRowActionsProps = {
  account: AccountRowActionModel;
};

export function AccountRowActions({ account }: AccountRowActionsProps) {
  const router = useRouter();

  return (
    <EntityRowActions
      openHref={`/entities/counterparty-accounts/${account.id}`}
      ariaLabel={`Действия для счёта ${account.label}`}
      deleteDialogTitle="Удалить счёт?"
      deleteDialogDescription="Счёт будет удалён без возможности восстановления."
      deleteFallbackMessage="Не удалось удалить счёт"
      deleteSuccessMessage="Счёт удалён"
      deleteRequest={() =>
        apiClient.v1["counterparty-accounts"][":id"].$delete({
          param: { id: account.id },
        })
      }
      onDeleted={() => {
        router.refresh();
      }}
      stopRowDoubleClick
    />
  );
}
