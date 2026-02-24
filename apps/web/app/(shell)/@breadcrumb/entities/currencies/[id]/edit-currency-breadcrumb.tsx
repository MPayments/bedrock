"use client";

import { useCurrencyDraftName } from "@/app/(shell)/entities/currencies/lib/create-draft-name-context";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";

type EditCurrencyBreadcrumbProps = {
  currencyId: string;
  initialLabel: string;
};

export function EditCurrencyBreadcrumb({
  currencyId,
  initialLabel,
}: EditCurrencyBreadcrumbProps) {
  const { getEditLabel } = useCurrencyDraftName();

  return (
    <DynamicBreadcrumb
      items={[
        {
          label: "Справочники",
          icon: "book-open",
        },
        {
          label: "Валюты",
          href: "/entities/currencies",
          icon: "dollar-sign",
        },
        {
          label: getEditLabel(currencyId, initialLabel),
          href: `/entities/currencies/${currencyId}`,
        },
      ]}
    />
  );
}
