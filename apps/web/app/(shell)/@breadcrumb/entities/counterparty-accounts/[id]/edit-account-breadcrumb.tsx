"use client";

import { useAccountDraftName } from "@/features/entities/counterparty-accounts/lib/create-draft-name-context";
import { EntityEditBreadcrumb } from "@/components/entities/entity-breadcrumb";

type EditAccountBreadcrumbProps = {
  accountId: string;
  initialLabel: string;
};

export function EditAccountBreadcrumb({
  accountId,
  initialLabel,
}: EditAccountBreadcrumbProps) {
  const { meta } = useAccountDraftName();

  return (
    <EntityEditBreadcrumb
      entityLabel="Счета"
      entityHref="/entities/counterparty-accounts"
      entityIcon="wallet"
      currentLabel={meta.getEditLabel(accountId, initialLabel)}
      currentHref={`/entities/counterparty-accounts/${accountId}`}
    />
  );
}
