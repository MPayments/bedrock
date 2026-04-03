import { schema as crmTasksSchema } from "crm/schema";

import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { schema as agreementsSchema } from "@bedrock/agreements/schema";
import { schema as calculationsSchema } from "@bedrock/calculations/schema";
import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import { schema as dealsSchema } from "@bedrock/deals/schema";
import { schema as documentsSchema } from "@bedrock/documents/schema";
import { schema as filesSchema } from "@bedrock/files/schema";
import {
  account,
  accountRelations,
  agentProfiles,
  agentProfilesRelations,
  customerBootstrapClaims,
  customerMemberships,
  portalAccessGrants,
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
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import {
  counterparties,
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterpartyRelationshipKindEnum,
  customerCounterpartyAssignments,
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
  customerMemberships,
  portalAccessGrants,
  userAccessStates,
  userAccessStatesRelations,
};
const partiesSchema: {
  customers: typeof customers;
  counterparties: typeof counterparties;
  counterpartyGroups: typeof counterpartyGroups;
  counterpartyGroupMemberships: typeof counterpartyGroupMemberships;
  counterpartyRelationshipKindEnum: typeof counterpartyRelationshipKindEnum;
  customerCounterpartyAssignments: typeof customerCounterpartyAssignments;
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
  customerCounterpartyAssignments,
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
  & typeof agreementsSchema
  & typeof calculationsSchema
  & typeof dealsSchema
  & typeof filesSchema
  & typeof ledgerSchema
  & typeof accountingSchema
  & typeof partiesSchema
  & typeof documentsSchema
  & typeof idempotencySchema
  & typeof treasurySchema
  & typeof currenciesSchema
  & typeof reconciliationSchema
  & typeof crmTasksSchema;

const schemaInternal: Schema = {
  ...authSchema,
  ...agreementsSchema,
  ...calculationsSchema,
  ...dealsSchema,
  ...filesSchema,
  ...ledgerSchema,
  ...accountingSchema,
  ...partiesSchema,
  ...documentsSchema,
  ...idempotencySchema,
  ...treasurySchema,
  ...currenciesSchema,
  ...reconciliationSchema,
  ...crmTasksSchema,
};

export const schema: Schema = schemaInternal;
