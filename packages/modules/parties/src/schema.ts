import {
  counterpartyCountryCodeEnum,
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterparties,
  counterpartyKindEnum,
  counterpartyRelationshipKindEnum,
} from "./counterparties/adapters/drizzle/schema";
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
import { subAgentProfiles } from "./sub-agent-profiles/adapters/drizzle/schema";

export {
  counterparties,
  counterpartyCountryCodeEnum,
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterpartyKindEnum,
  counterpartyRelationshipKindEnum,
  customers,
  organizations,
  partyCountryCodeEnum,
  partyKindEnum,
  organizationRequisiteBindings,
  requisiteKindEnum,
  requisiteOwnerTypeEnum,
  requisiteProviders,
  requisites,
  subAgentProfiles,
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
  counterpartyRelationshipKindEnum,
  requisiteOwnerTypeEnum,
  requisiteKindEnum,
  requisiteProviders,
  requisites,
  organizationRequisiteBindings,
  subAgentProfiles,
};
