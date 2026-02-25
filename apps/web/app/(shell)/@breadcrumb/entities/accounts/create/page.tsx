"use client";

import { useAccountDraftName } from "@/app/(shell)/entities/accounts/lib/create-draft-name-context";
import { EntityCreateBreadcrumb } from "@/components/entities/entity-breadcrumb";

export default function CreateAccountBreadcrumbPage() {
  const { state } = useAccountDraftName();

  return (
    <EntityCreateBreadcrumb
      entityLabel="Счета"
      entityHref="/entities/accounts"
      entityIcon="wallet"
      currentLabel={state.createLabel}
      currentHref="/entities/accounts/create"
    />
  );
}
