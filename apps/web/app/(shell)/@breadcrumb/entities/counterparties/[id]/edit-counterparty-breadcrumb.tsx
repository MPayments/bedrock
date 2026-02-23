"use client";

import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { useCounterpartyCreateDraftName } from "@/app/(shell)/entities/counterparties/lib/create-draft-name-context";

type EditCounterpartyBreadcrumbProps = {
  counterpartyId: string;
  initialLabel: string;
};

export function EditCounterpartyBreadcrumb({
  counterpartyId,
  initialLabel,
}: EditCounterpartyBreadcrumbProps) {
  const { getEditLabel } = useCounterpartyCreateDraftName();

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
          label: getEditLabel(counterpartyId, initialLabel),
          href: `/entities/counterparties/${counterpartyId}`,
        },
      ]}
    />
  );
}
