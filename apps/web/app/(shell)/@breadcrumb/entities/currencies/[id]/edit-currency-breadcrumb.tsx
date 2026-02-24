"use client";

import { useCurrencyDraftName } from "@/app/(shell)/entities/currencies/lib/create-draft-name-context";
import { EntityEditBreadcrumb } from "@/components/entities/entity-breadcrumb";

type EditCurrencyBreadcrumbProps = {
  currencyId: string;
  initialLabel: string;
};

export function EditCurrencyBreadcrumb({
  currencyId,
  initialLabel,
}: EditCurrencyBreadcrumbProps) {
  const { meta } = useCurrencyDraftName();

  return (
    <EntityEditBreadcrumb
      entityLabel="Валюты"
      entityHref="/entities/currencies"
      entityIcon="dollar-sign"
      currentLabel={meta.getEditLabel(currencyId, initialLabel)}
      currentHref={`/entities/currencies/${currencyId}`}
    />
  );
}
