"use client";

import { useCustomerDraftName } from "@/features/entities/customers/lib/create-draft-name-context";
import { EntityCreateBreadcrumb } from "@/components/entities/entity-breadcrumb";

export default function CreateCustomerBreadcrumbPage() {
  const { state } = useCustomerDraftName();

  return (
    <EntityCreateBreadcrumb
      entityLabel="Клиенты"
      entityHref="/entities/customers"
      entityIcon="handshake"
      currentLabel={state.createLabel}
      currentHref="/entities/customers/create"
    />
  );
}
