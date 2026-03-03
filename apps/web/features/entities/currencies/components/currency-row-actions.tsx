"use client";

import { useRouter } from "next/navigation";

import { EntityRowActions } from "@/components/entities/entity-row-actions";
import { apiClient } from "@/lib/api-client";

type CurrencyRowActionModel = {
  id: string;
  code: string;
};

type CurrencyRowActionsProps = {
  currency: CurrencyRowActionModel;
};

export function CurrencyRowActions({ currency }: CurrencyRowActionsProps) {
  const router = useRouter();

  return (
    <EntityRowActions
      openHref={`/entities/currencies/${currency.id}`}
      ariaLabel={`Действия для валюты ${currency.code}`}
      deleteDialogTitle="Удалить валюту?"
      deleteDialogDescription="Валюта будет удалена без возможности восстановления."
      deleteFallbackMessage="Не удалось удалить валюту"
      deleteSuccessMessage="Валюта удалена"
      deleteRequest={() =>
        apiClient.v1.currencies[":id"].$delete({
          param: { id: currency.id },
        })
      }
      onDeleted={() => {
        router.refresh();
      }}
      stopRowDoubleClick
    />
  );
}
