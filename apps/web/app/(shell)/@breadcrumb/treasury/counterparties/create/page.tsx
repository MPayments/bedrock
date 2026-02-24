"use client";

import { useCounterpartyDraftName } from "@/app/(shell)/entities/counterparties/lib/create-draft-name-context";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";

export default function TreasuryCreateCounterpartyBreadcrumbPage() {
  const { state } = useCounterpartyDraftName();

  return (
    <DynamicBreadcrumb
      items={[
        {
          label: "Казначейство",
          icon: "landmark",
        },
        {
          label: "Контрагенты",
          href: "/treasury/counterparties",
          icon: "building-2",
        },
        {
          label: state.createLabel,
          href: "/treasury/counterparties/create",
        },
      ]}
    />
  );
}
