"use client";

import { useAccountDraftName } from "@/features/entities/counterparty-accounts/lib/create-draft-name-context";
import { EntityCreateBreadcrumb } from "@/components/entities/entity-breadcrumb";

export default function CreateAccountBreadcrumbPage() {
  const { state } = useAccountDraftName();

  return (
    <EntityCreateBreadcrumb
      entityLabel="Счета"
      entityHref="/entities/counterparty-accounts"
      entityIcon="wallet"
      currentLabel={state.createLabel}
      currentHref="/entities/counterparty-accounts/create"
    />
  );
}
