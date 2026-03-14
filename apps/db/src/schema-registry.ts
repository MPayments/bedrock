import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { schema as balancesSchema } from "@bedrock/balances/schema";
import { schema as counterpartiesSchema } from "@bedrock/counterparties/schema";
import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import { schema as customersSchema } from "@bedrock/customers/schema";
import { schema as documentsSchema } from "@bedrock/documents/schema";
import { schema as feesSchema } from "@bedrock/fees/schema";
import { schema as fxSchema } from "@bedrock/fx/schema";
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
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { schema as organizationsSchema } from "@bedrock/organizations/schema";
import { schema as reconciliationSchema } from "@bedrock/reconciliation/schema";
import { schema as requisitesSchema } from "@bedrock/requisites/schema";

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

export type Schema =
  & typeof authSchema
  & typeof ledgerSchema
  & typeof accountingSchema
  & typeof counterpartiesSchema
  & typeof customersSchema
  & typeof documentsSchema
  & typeof idempotencySchema
  & typeof fxSchema
  & typeof feesSchema
  & typeof currenciesSchema
  & typeof organizationsSchema
  & typeof balancesSchema
  & typeof requisitesSchema
  & typeof reconciliationSchema;

const schemaInternal: Schema = {
  ...authSchema,
  ...ledgerSchema,
  ...accountingSchema,
  ...counterpartiesSchema,
  ...customersSchema,
  ...documentsSchema,
  ...idempotencySchema,
  ...fxSchema,
  ...feesSchema,
  ...currenciesSchema,
  ...organizationsSchema,
  ...balancesSchema,
  ...requisitesSchema,
  ...reconciliationSchema,
};

export const schema: Schema = schemaInternal;
