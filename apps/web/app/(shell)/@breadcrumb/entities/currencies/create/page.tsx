"use client";

import { useCurrencyDraftName } from "@/app/(shell)/entities/currencies/lib/create-draft-name-context";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";

export default function CreateCurrencyBreadcrumbPage() {
  const { createLabel } = useCurrencyDraftName();

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
          label: createLabel,
          href: "/entities/currencies/create",
        },
      ]}
    />
  );
}
