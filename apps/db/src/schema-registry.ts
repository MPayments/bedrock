import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import { schema as documentsSchema } from "@bedrock/documents/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { schema as operationsSchema } from "@bedrock/operations/schema";
import {
  counterparties,
  counterpartyGroupMemberships,
  counterpartyGroups,
  customerMemberships,
  customers,
  organizations,
  organizationRequisiteBindings,
  requisiteKindEnum,
  requisiteOwnerTypeEnum,
  requisiteProviders,
  requisites,
} from "@bedrock/parties/schema";
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  twoFactor,
  twoFactorRelations,
  user,
  userRelations,
  verification,
} from "@bedrock/platform/auth-model/schema";
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
};
const partiesSchema = {
  customers,
  customerMemberships,
  counterparties,
  counterpartyGroups,
  counterpartyGroupMemberships,
  organizations,
  requisiteOwnerTypeEnum,
  requisiteKindEnum,
  requisiteProviders,
  requisites,
  organizationRequisiteBindings,
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
