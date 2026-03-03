"use client";

import { AccountDraftNameProvider } from "@/features/entities/counterparty-accounts/lib/create-draft-name-context";
import { CounterpartyDraftNameProvider } from "@/features/entities/counterparties/lib/create-draft-name-context";
import { CurrencyDraftNameProvider } from "@/features/entities/currencies/lib/create-draft-name-context";
import { CustomerDraftNameProvider } from "@/features/entities/customers/lib/create-draft-name-context";
import { ProviderDraftNameProvider } from "@/features/entities/counterparty-account-providers/lib/create-draft-name-context";

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
