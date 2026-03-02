"use client";

import { useProviderDraftName } from "@/app/(shell)/entities/counterparty-account-providers/lib/create-draft-name-context";
import { EntityCreateBreadcrumb } from "@/components/entities/entity-breadcrumb";

export default function CreateProviderBreadcrumbPage() {
  const { state } = useProviderDraftName();

  return (
    <EntityCreateBreadcrumb
      entityLabel="Расчетные методы"
      entityHref="/entities/counterparty-account-providers"
      entityIcon="landmark"
      currentLabel={state.createLabel}
      currentHref="/entities/counterparty-account-providers/create"
    />
  );
}
