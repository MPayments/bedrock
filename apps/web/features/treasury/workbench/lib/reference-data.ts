import "server-only";

import { cache } from "react";

import { getCounterparties } from "@/features/entities/counterparties/lib/queries";
import { getCurrencies } from "@/features/entities/currencies/lib/queries";
import { getCustomers } from "@/features/entities/customers/lib/queries";
import { getOrganizations } from "@/features/entities/organizations/lib/queries";
import { getRequisiteProviders } from "@/features/entities/requisite-providers/lib/queries";

export type TreasuryReferenceData = {
  assetLabels: Record<string, string>;
  counterpartyLabels: Record<string, string>;
  customerLabels: Record<string, string>;
  organizationLabels: Record<string, string>;
  providerLabels: Record<string, string>;
};

const loadTreasuryReferenceDataUncached = async (): Promise<TreasuryReferenceData> => {
  const [
    organizations,
    currencies,
    customers,
    counterparties,
    requisiteProviders,
  ] =
    await Promise.all([
      getOrganizations({ page: 1, perPage: 200 }),
      getCurrencies({ page: 1, perPage: 200 }),
      getCustomers({ page: 1, perPage: 200 }),
      getCounterparties({ page: 1, perPage: 200 }),
      getRequisiteProviders({ page: 1, perPage: 200 }),
    ]);

  return {
    assetLabels: Object.fromEntries(
      currencies.data.map((currency) => [currency.id, currency.code]),
    ),
    counterpartyLabels: Object.fromEntries(
      counterparties.data.map((counterparty) => [
        counterparty.id,
        counterparty.shortName,
      ]),
    ),
    customerLabels: Object.fromEntries(
      customers.data.map((customer) => [customer.id, customer.displayName]),
    ),
    organizationLabels: Object.fromEntries(
      organizations.data.map((organization) => [
        organization.id,
        organization.shortName,
      ]),
    ),
    providerLabels: Object.fromEntries(
      requisiteProviders.data.map((provider) => [provider.id, provider.name]),
    ),
  };
};

export const getTreasuryReferenceData = cache(loadTreasuryReferenceDataUncached);
