import {
  account,
  accountRelations,
  agentProfiles,
  agentProfilesRelations,
  customerBootstrapClaims,
  customerMemberships,
  session,
  sessionRelations,
  twoFactor,
  twoFactorRelations,
  user,
  userAccessStates,
  userAccessStatesRelations,
  userRelations,
  verification,
} from "@bedrock/iam/schema";
import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import { schema as documentsSchema } from "@bedrock/documents/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { schema as operationsSchema } from "@bedrock/operations/schema";
import {
  counterparties,
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterpartyRelationshipKindEnum,
  customers,
  organizations,
  organizationRequisiteBindings,
  requisiteKindEnum,
  requisiteOwnerTypeEnum,
  requisiteProviders,
  requisites,
  subAgentProfiles,
} from "@bedrock/parties/schema";
import { schema as idempotencySchema } from "@bedrock/platform/idempotency-postgres/schema";
import { schema as reconciliationSchema } from "@bedrock/reconciliation/schema";
import { schema as treasurySchema } from "@bedrock/treasury/schema";

const authSchema = {
  user,
  account,
  session,
  verification,
  twoFactor,
  userRelations,
  sessionRelations,
  accountRelations,
  twoFactorRelations,
  agentProfiles,
  agentProfilesRelations,
  customerBootstrapClaims,
  userAccessStates,
  userAccessStatesRelations,
};
const partiesSchema: {
  customers: typeof customers;
  counterparties: typeof counterparties;
  counterpartyGroups: typeof counterpartyGroups;
  counterpartyGroupMemberships: typeof counterpartyGroupMemberships;
  counterpartyRelationshipKindEnum: typeof counterpartyRelationshipKindEnum;
  organizations: typeof organizations;
  requisiteOwnerTypeEnum: typeof requisiteOwnerTypeEnum;
  requisiteKindEnum: typeof requisiteKindEnum;
  requisiteProviders: typeof requisiteProviders;
  requisites: typeof requisites;
  organizationRequisiteBindings: typeof organizationRequisiteBindings;
  subAgentProfiles: typeof subAgentProfiles;
} = {
  customers,
  counterparties,
  counterpartyGroups,
  counterpartyGroupMemberships,
  counterpartyRelationshipKindEnum,
  organizations,
  requisiteOwnerTypeEnum,
  requisiteKindEnum,
  requisiteProviders,
  requisites,
  organizationRequisiteBindings,
  subAgentProfiles,
};

export type Schema =
  & typeof authSchema
  & typeof ledgerSchema
  & typeof accountingSchema
  & typeof partiesSchema
  & typeof documentsSchema
  & typeof idempotencySchema
  & typeof treasurySchema
  & typeof currenciesSchema
  & typeof reconciliationSchema
  & typeof operationsSchema;

const schemaInternal: Schema = {
  ...authSchema,
  ...ledgerSchema,
  ...accountingSchema,
  ...partiesSchema,
  ...documentsSchema,
  ...idempotencySchema,
  ...treasurySchema,
  ...currenciesSchema,
  ...reconciliationSchema,
  ...operationsSchema,
};

export const schema: Schema = schemaInternal;
