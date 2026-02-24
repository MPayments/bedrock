"use client";

import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { useCounterpartyCreateDraftName } from "@/app/(shell)/entities/counterparties/lib/create-draft-name-context";

export default function CreateCounterpartyBreadcrumbPage() {
  const { createLabel } = useCounterpartyCreateDraftName();

  return (
    <DynamicBreadcrumb
      items={[
        {
          label: "Справочники",
          icon: "book-open",
        },
        {
          label: "Контрагенты",
          href: "/entities/counterparties",
          icon: "building-2",
        },
        {
          label: createLabel,
          href: "/entities/counterparties/create",
        },
      ]}
    />
  );
}
