import { token } from "@bedrock/core";
import type { CounterpartiesService } from "@multihansa/parties/counterparties";
import type { CustomersService } from "@multihansa/parties/customers";
import type { OrganizationsService } from "@multihansa/parties/organizations";
import type { RequisiteProvidersService } from "@multihansa/parties/requisite-providers";
import type { RequisitesService } from "@multihansa/parties/requisites";

export const CounterpartiesDomainServiceToken = token<CounterpartiesService>(
  "multihansa.parties.counterparties-domain-service",
);

export const CustomersDomainServiceToken = token<CustomersService>(
  "multihansa.parties.customers-domain-service",
);

export const OrganizationsDomainServiceToken = token<OrganizationsService>(
  "multihansa.parties.organizations-domain-service",
);

export const RequisiteProvidersDomainServiceToken =
  token<RequisiteProvidersService>(
    "multihansa.parties.requisite-providers-domain-service",
  );

export const RequisitesDomainServiceToken = token<RequisitesService>(
  "multihansa.parties.requisites-domain-service",
);
