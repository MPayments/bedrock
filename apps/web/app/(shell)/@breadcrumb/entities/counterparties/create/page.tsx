"use client";

import { useCounterpartyDraftName } from "@/features/entities/counterparties/lib/create-draft-name-context";
import { EntityCreateBreadcrumb } from "@/components/entities/entity-breadcrumb";

export default function CreateCounterpartyBreadcrumbPage() {
  const { state } = useCounterpartyDraftName();

  return (
    <EntityCreateBreadcrumb
      entityLabel="Контрагенты"
      entityHref="/entities/parties/counterparties"
      entityIcon="building-2"
      currentLabel={state.createLabel}
      currentHref="/entities/parties/counterparties/create"
    />
  );
}
