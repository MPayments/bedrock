"use client";

import { CounterpartyDraftNameProvider } from "@/app/(shell)/entities/counterparties/lib/create-draft-name-context";
import { CurrencyDraftNameProvider } from "@/app/(shell)/entities/currencies/lib/create-draft-name-context";
import { CustomerDraftNameProvider } from "@/app/(shell)/entities/customers/lib/create-draft-name-context";

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
