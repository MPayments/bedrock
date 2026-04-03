import {
  customerCounterpartyAssignments,
  counterpartyCountryCodeEnum,
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterparties,
  counterpartyKindEnum,
  counterpartyRelationshipKindEnum,
  type LocalizedText,
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
  customerCounterpartyAssignments,
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterpartyKindEnum,
  counterpartyRelationshipKindEnum,
  type LocalizedText,
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
  customerCounterpartyAssignments,
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
