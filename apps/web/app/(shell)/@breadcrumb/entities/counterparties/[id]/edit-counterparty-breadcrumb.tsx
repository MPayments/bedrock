"use client";

import { useCounterpartyDraftName } from "@/features/entities/counterparties/lib/create-draft-name-context";
import { EntityEditBreadcrumb } from "@/components/entities/entity-breadcrumb";

type EditCounterpartyBreadcrumbProps = {
  counterpartyId: string;
  initialLabel: string;
};

export function EditCounterpartyBreadcrumb({
  counterpartyId,
  initialLabel,
}: EditCounterpartyBreadcrumbProps) {
  const { meta } = useCounterpartyDraftName();

  return (
    <EntityEditBreadcrumb
      entityLabel="Контрагенты"
      entityHref="/entities/parties/counterparties"
      entityIcon="building-2"
      currentLabel={meta.getEditLabel(counterpartyId, initialLabel)}
      currentHref={`/entities/parties/counterparties/${counterpartyId}`}
    />
  );
}
