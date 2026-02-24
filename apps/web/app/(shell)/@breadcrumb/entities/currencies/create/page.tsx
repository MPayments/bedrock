"use client";

import { useCurrencyDraftName } from "@/app/(shell)/entities/currencies/lib/create-draft-name-context";
import { EntityCreateBreadcrumb } from "@/components/entities/entity-breadcrumb";

export default function CreateCurrencyBreadcrumbPage() {
  const { state } = useCurrencyDraftName();

  return (
    <EntityCreateBreadcrumb
      entityLabel="Валюты"
      entityHref="/entities/currencies"
      entityIcon="dollar-sign"
      currentLabel={state.createLabel}
      currentHref="/entities/currencies/create"
    />
  );
}
