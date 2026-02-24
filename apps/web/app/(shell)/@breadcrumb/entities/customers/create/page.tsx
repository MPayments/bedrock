"use client";

import { useCustomerDraftName } from "@/app/(shell)/entities/customers/lib/create-draft-name-context";
import { EntityCreateBreadcrumb } from "@/components/entities/entity-breadcrumb";

export default function CreateCustomerBreadcrumbPage() {
  const { state } = useCustomerDraftName();

  return (
    <EntityCreateBreadcrumb
      entityLabel="Клиенты"
      entityHref="/entities/customers"
      entityIcon="users"
      currentLabel={state.createLabel}
      currentHref="/entities/customers/create"
    />
  );
}
