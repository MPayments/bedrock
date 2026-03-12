import { schema as accountingSchema } from "@bedrock/application/accounting/schema";
import { schema as accountingReportingSchema } from "@bedrock/application/accounting-reporting/schema";
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
} from "@bedrock/application/auth/schema";
import { schema as balancesSchema } from "@bedrock/application/balances/schema";
import { schema as counterpartiesSchema } from "@bedrock/application/counterparties/schema";
import { schema as currenciesSchema } from "@bedrock/application/currencies/schema";
import { schema as customersSchema } from "@bedrock/application/customers/schema";
import { schema as documentsSchema } from "@bedrock/application/documents/schema";
import { schema as feesSchema } from "@bedrock/application/fees/schema";
import { schema as fxSchema } from "@bedrock/application/fx/schema";
import { schema as idempotencySchema } from "@bedrock/application/idempotency/schema";
import { schema as ledgerSchema } from "@bedrock/application/ledger/schema";
import { schema as moduleRuntimeSchema } from "@bedrock/application/module-runtime/schema";
import { schema as organizationsSchema } from "@bedrock/application/organizations/schema";
import { schema as reconciliationSchema } from "@bedrock/application/reconciliation/schema";
import { schema as requisiteProvidersSchema } from "@bedrock/application/requisite-providers/schema";
import { schema as requisitesSchema } from "@bedrock/application/requisites/schema";

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

type CombinedSchema =
  & typeof authSchema
  & typeof ledgerSchema
  & typeof accountingSchema
  & typeof accountingReportingSchema
  & typeof counterpartiesSchema
  & typeof customersSchema
  & typeof documentsSchema
  & typeof idempotencySchema
  & typeof fxSchema
  & typeof feesSchema
  & typeof currenciesSchema
  & typeof moduleRuntimeSchema
  & typeof organizationsSchema
  & typeof requisiteProvidersSchema
  & typeof balancesSchema
  & typeof requisitesSchema
  & typeof reconciliationSchema;

const schemaInternal: CombinedSchema = {
  ...authSchema,
  ...ledgerSchema,
  ...accountingSchema,
  ...accountingReportingSchema,
  ...counterpartiesSchema,
  ...customersSchema,
  ...documentsSchema,
  ...idempotencySchema,
  ...fxSchema,
  ...feesSchema,
  ...currenciesSchema,
  ...moduleRuntimeSchema,
  ...organizationsSchema,
  ...requisiteProvidersSchema,
  ...balancesSchema,
  ...requisitesSchema,
  ...reconciliationSchema,
};

export type Schema = CombinedSchema;
export const schema: Schema = schemaInternal;
