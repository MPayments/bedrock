import { schema as accountingSchema } from "@bedrock/app/accounting/schema";
import { schema as accountingReportingSchema } from "@bedrock/app/accounting-reporting/schema";
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
} from "@bedrock/app/auth/schema";
import { schema as balancesSchema } from "@bedrock/app/balances/schema";
import { schema as counterpartiesSchema } from "@bedrock/app/counterparties/schema";
import { schema as currenciesSchema } from "@bedrock/app/currencies/schema";
import { schema as customersSchema } from "@bedrock/app/customers/schema";
import { schema as documentsSchema } from "@bedrock/app/documents/schema";
import { schema as feesSchema } from "@bedrock/app/fees/schema";
import { schema as fxSchema } from "@bedrock/app/fx/schema";
import { schema as idempotencySchema } from "@bedrock/app/idempotency/schema";
import { schema as ledgerSchema } from "@bedrock/app/ledger/schema";
import { schema as moduleRuntimeSchema } from "@bedrock/app/module-runtime/schema";
import { schema as organizationsSchema } from "@bedrock/app/organizations/schema";
import { schema as reconciliationSchema } from "@bedrock/app/reconciliation/schema";
import { schema as requisiteProvidersSchema } from "@bedrock/app/requisite-providers/schema";
import { schema as requisitesSchema } from "@bedrock/app/requisites/schema";

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
