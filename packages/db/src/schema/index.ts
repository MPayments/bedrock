import { schema as accountingReportingSchema } from "@bedrock/application/accounting-reporting/schema";
import { schema as feesSchema } from "@bedrock/application/fees/schema";
import { schema as fxSchema } from "@bedrock/application/fx/schema";
import { schema as accountingSchema } from "@bedrock/core/accounting/schema";
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
} from "@bedrock/core/auth/schema";
import { schema as balancesSchema } from "@bedrock/core/balances/schema";
import { schema as counterpartiesSchema } from "@bedrock/core/counterparties/schema";
import { schema as currenciesSchema } from "@bedrock/core/currencies/schema";
import { schema as customersSchema } from "@bedrock/core/customers/schema";
import { schema as documentsSchema } from "@bedrock/core/documents/schema";
import { schema as idempotencySchema } from "@bedrock/core/idempotency/schema";
import { schema as ledgerSchema } from "@bedrock/core/ledger/schema";
import { schema as moduleRuntimeSchema } from "@bedrock/core/module-runtime/schema";
import { schema as organizationsSchema } from "@bedrock/core/organizations/schema";
import { schema as requisiteProvidersSchema } from "@bedrock/core/requisite-providers/schema";
import { schema as reconciliationSchema } from "@bedrock/core/reconciliation/schema";
import { schema as requisitesSchema } from "@bedrock/core/requisites/schema";

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
