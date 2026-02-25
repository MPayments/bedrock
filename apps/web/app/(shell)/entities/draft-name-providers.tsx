"use client";

import { AccountDraftNameProvider } from "@/app/(shell)/entities/accounts/lib/create-draft-name-context";
import { CounterpartyDraftNameProvider } from "@/app/(shell)/entities/counterparties/lib/create-draft-name-context";
import { CurrencyDraftNameProvider } from "@/app/(shell)/entities/currencies/lib/create-draft-name-context";
import { CustomerDraftNameProvider } from "@/app/(shell)/entities/customers/lib/create-draft-name-context";
import { ProviderDraftNameProvider } from "@/app/(shell)/entities/providers/lib/create-draft-name-context";

export function EntityDraftNameProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CounterpartyDraftNameProvider>
      <CustomerDraftNameProvider>
        <CurrencyDraftNameProvider>
          <ProviderDraftNameProvider>
            <AccountDraftNameProvider>{children}</AccountDraftNameProvider>
          </ProviderDraftNameProvider>
        </CurrencyDraftNameProvider>
      </CustomerDraftNameProvider>
    </CounterpartyDraftNameProvider>
  );
}
