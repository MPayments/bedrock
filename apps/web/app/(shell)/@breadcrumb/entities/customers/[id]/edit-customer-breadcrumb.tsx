"use client";

import { useCustomerDraftName } from "@/app/(shell)/entities/customers/lib/create-draft-name-context";
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
      entityHref="/entities/customers"
      entityIcon="users"
      currentLabel={meta.getEditLabel(customerId, initialLabel)}
      currentHref={`/entities/customers/${customerId}`}
    />
  );
}
