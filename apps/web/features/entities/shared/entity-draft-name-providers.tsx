"use client";

import { CounterpartyDraftNameProvider } from "@/features/entities/counterparties/lib/create-draft-name-context";
import { CurrencyDraftNameProvider } from "@/features/entities/currencies/lib/create-draft-name-context";
import { CustomerDraftNameProvider } from "@/features/entities/customers/lib/create-draft-name-context";

export function EntityDraftNameProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CounterpartyDraftNameProvider>
      <CustomerDraftNameProvider>
        <CurrencyDraftNameProvider>{children}</CurrencyDraftNameProvider>
      </CustomerDraftNameProvider>
    </CounterpartyDraftNameProvider>
  );
}
