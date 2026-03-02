import { schema as feesSchema } from "@bedrock/modules/fees/schema";
import { schema as fxSchema } from "@bedrock/modules/fx/schema";
import { schema as accountingSchema } from "@bedrock/platform/accounting/schema";
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "@bedrock/platform/auth/schema";
import { schema as balancesSchema } from "@bedrock/platform/balances/schema";
import { schema as componentRuntimeSchema } from "@bedrock/platform/component-runtime/schema";
import { schema as connectorsSchema } from "@bedrock/platform/connectors/schema";
import { schema as counterpartiesSchema } from "@bedrock/platform/counterparties/schema";
import { schema as currenciesSchema } from "@bedrock/platform/currencies/schema";
import { schema as customersSchema } from "@bedrock/platform/customers/schema";
import { schema as documentsSchema } from "@bedrock/platform/documents/schema";
import { schema as idempotencySchema } from "@bedrock/platform/idempotency/schema";
import { schema as ledgerSchema } from "@bedrock/platform/ledger/schema";
import { schema as operationalAccountsSchema } from "@bedrock/platform/operational-accounts/schema";
import { schema as orchestrationSchema } from "@bedrock/platform/orchestration/schema";
import { schema as reconciliationSchema } from "@bedrock/platform/reconciliation/schema";

const authSchema = {
  user,
  account,
  session,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
};

type CombinedSchema =
  & typeof authSchema
  & typeof ledgerSchema
  & typeof accountingSchema
  & typeof counterpartiesSchema
  & typeof customersSchema
  & typeof documentsSchema
  & typeof idempotencySchema
  & typeof operationalAccountsSchema
  & typeof fxSchema
  & typeof feesSchema
  & typeof currenciesSchema
  & typeof connectorsSchema
  & typeof componentRuntimeSchema
  & typeof orchestrationSchema
  & typeof balancesSchema
  & typeof reconciliationSchema;

const schemaInternal: CombinedSchema = {
  ...authSchema,
  ...ledgerSchema,
  ...accountingSchema,
  ...counterpartiesSchema,
  ...customersSchema,
  ...documentsSchema,
  ...idempotencySchema,
  ...operationalAccountsSchema,
  ...fxSchema,
  ...feesSchema,
  ...currenciesSchema,
  ...connectorsSchema,
  ...componentRuntimeSchema,
  ...orchestrationSchema,
  ...balancesSchema,
  ...reconciliationSchema,
};

export type Schema = CombinedSchema;
export const schema: Schema = schemaInternal;
