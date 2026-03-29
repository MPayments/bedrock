"use client";

import { CounterpartyDraftNameProvider } from "@/features/entities/counterparties/lib/create-draft-name-context";
import { CurrencyDraftNameProvider } from "@/features/entities/currencies/lib/create-draft-name-context";
import { CustomerDraftNameProvider } from "@/features/entities/customers/lib/create-draft-name-context";
import { OrganizationDraftNameProvider } from "@/features/entities/organizations/lib/create-draft-name-context";

export function EntityDraftNameProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CounterpartyDraftNameProvider>
      <CustomerDraftNameProvider>
        <CurrencyDraftNameProvider>
          <OrganizationDraftNameProvider>{children}</OrganizationDraftNameProvider>
        </CurrencyDraftNameProvider>
      </CustomerDraftNameProvider>
    </CounterpartyDraftNameProvider>
  );
}
