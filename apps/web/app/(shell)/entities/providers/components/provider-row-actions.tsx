"use client";

import { useRouter } from "next/navigation";

import { EntityRowActions } from "@/components/entities/entity-row-actions";
import { apiClient } from "@/lib/api-client";

type ProviderRowActionModel = {
  id: string;
  name: string;
};

type ProviderRowActionsProps = {
  provider: ProviderRowActionModel;
};

export function ProviderRowActions({ provider }: ProviderRowActionsProps) {
  const router = useRouter();

  return (
    <EntityRowActions
      openHref={`/entities/providers/${provider.id}`}
      ariaLabel={`Действия для провайдера ${provider.name}`}
      deleteDialogTitle="Удалить провайдера?"
      deleteDialogDescription="Провайдер будет удалён без возможности восстановления. Если к нему привязаны счета, удаление невозможно."
      deleteFallbackMessage="Не удалось удалить провайдера"
      deleteSuccessMessage="Провайдер удалён"
      deleteRequest={() =>
        apiClient.v1["account-providers"][":id"].$delete({
          param: { id: provider.id },
        })
      }
      onDeleted={() => {
        router.refresh();
      }}
      stopRowDoubleClick
    />
  );
}
