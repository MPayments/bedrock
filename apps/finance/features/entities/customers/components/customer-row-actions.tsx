"use client";

import { useRouter } from "next/navigation";

import { EntityRowActions } from "@/components/entities/entity-row-actions";
import { apiClient } from "@/lib/api-client";

type CustomerRowActionModel = {
  id: string;
  displayName: string;
};

type CustomerRowActionsProps = {
  customer: CustomerRowActionModel;
};

export function CustomerRowActions({ customer }: CustomerRowActionsProps) {
  const router = useRouter();

  return (
    <EntityRowActions
      openHref={`/entities/customers/${customer.id}`}
      ariaLabel={`Действия для клиента ${customer.displayName}`}
      deleteDialogTitle="Удалить клиента?"
      deleteDialogDescription="Клиент будет удален без возможности восстановления."
      deleteFallbackMessage="Не удалось удалить клиента"
      deleteSuccessMessage="Клиент удален"
      deleteRequest={() =>
        apiClient.v1.customers[":id"].$delete({
          param: { id: customer.id },
        })
      }
      onDeleted={() => {
        router.refresh();
      }}
    />
  );
}
