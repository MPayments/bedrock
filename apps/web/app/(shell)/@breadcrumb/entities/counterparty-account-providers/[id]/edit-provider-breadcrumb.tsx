"use client";

import { useProviderDraftName } from "@/app/(shell)/entities/counterparty-account-providers/lib/create-draft-name-context";
import { EntityEditBreadcrumb } from "@/components/entities/entity-breadcrumb";

type EditProviderBreadcrumbProps = {
  providerId: string;
  initialLabel: string;
};

export function EditProviderBreadcrumb({
  providerId,
  initialLabel,
}: EditProviderBreadcrumbProps) {
  const { meta } = useProviderDraftName();

  return (
    <EntityEditBreadcrumb
      entityLabel="Расчетные методы"
      entityHref="/entities/counterparty-account-providers"
      entityIcon="landmark"
      currentLabel={meta.getEditLabel(providerId, initialLabel)}
      currentHref={`/entities/counterparty-account-providers/${providerId}`}
    />
  );
}
