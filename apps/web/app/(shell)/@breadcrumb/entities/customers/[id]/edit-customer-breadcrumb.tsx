"use client";

import { useCustomerDraftName } from "@/features/entities/customers/lib/create-draft-name-context";
import { EntityEditBreadcrumb } from "@/components/entities/entity-breadcrumb";

type EditCustomerBreadcrumbProps = {
  customerId: string;
  initialLabel: string;
};

export function EditCustomerBreadcrumb({
  customerId,
  initialLabel,
}: EditCustomerBreadcrumbProps) {
  const { meta } = useCustomerDraftName();

  return (
    <EntityEditBreadcrumb
      entityLabel="Клиенты"
      entityHref="/entities/parties/customers"
      entityIcon="handshake"
      currentLabel={meta.getEditLabel(customerId, initialLabel)}
      currentHref={`/entities/parties/customers/${customerId}`}
    />
  );
}
