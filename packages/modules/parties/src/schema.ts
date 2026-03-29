import {
  counterpartyCountryCodeEnum,
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterparties,
  counterpartyKindEnum,
} from "./counterparties/adapters/drizzle/schema";
import { customerMemberships } from "./customer-memberships/adapters/drizzle/schema";
import { customers } from "./customers/adapters/drizzle/schema";
import {
  organizations,
  partyCountryCodeEnum,
  partyKindEnum,
} from "./organizations/adapters/drizzle/schema";
import {
  organizationRequisiteBindings,
  requisiteKindEnum,
  requisiteOwnerTypeEnum,
  requisiteProviders,
  requisites,
} from "./requisites/adapters/drizzle/schema";

export {
  counterparties,
  counterpartyCountryCodeEnum,
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterpartyKindEnum,
  customerMemberships,
  customers,
  organizations,
  partyCountryCodeEnum,
  partyKindEnum,
  organizationRequisiteBindings,
  requisiteKindEnum,
  requisiteOwnerTypeEnum,
  requisiteProviders,
  requisites,
};

export const schema = {
  customers,
  partyKindEnum,
  partyCountryCodeEnum,
  organizations,
  counterpartyKindEnum,
  counterpartyCountryCodeEnum,
  counterparties,
  counterpartyGroups,
  counterpartyGroupMemberships,
  customerMemberships,
  requisiteOwnerTypeEnum,
  requisiteKindEnum,
  requisiteProviders,
  requisites,
  organizationRequisiteBindings,
};
