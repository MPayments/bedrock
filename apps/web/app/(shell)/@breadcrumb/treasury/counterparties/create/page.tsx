"use client";

import { useCounterpartyDraftName } from "@/features/entities/counterparties/lib/create-draft-name-context";
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
          label: "Организации",
          href: "/treasury/organizations",
          icon: "landmark",
        },
        {
          label: state.createLabel,
          href: "/treasury/organizations/create",
        },
      ]}
    />
  );
}
