"use client";

import { useAccountDraftName } from "@/app/(shell)/entities/accounts/lib/create-draft-name-context";
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
      entityHref="/entities/accounts"
      entityIcon="wallet"
      currentLabel={meta.getEditLabel(accountId, initialLabel)}
      currentHref={`/entities/accounts/${accountId}`}
    />
  );
}
