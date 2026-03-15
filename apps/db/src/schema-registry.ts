import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { schema as balancesSchema } from "@bedrock/balances/schema";
import { schema as partiesSchema } from "@bedrock/parties/schema";
import { schema as currenciesSchema } from "@bedrock/currencies/schema";
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
import { schema as requisiteProvidersSchema } from "@bedrock/requisite-providers/schema";

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
  & typeof partiesSchema
  & typeof documentsSchema
  & typeof idempotencySchema
  & typeof fxSchema
  & typeof feesSchema
  & typeof currenciesSchema
  & typeof organizationsSchema
  & typeof balancesSchema
  & typeof requisiteProvidersSchema
  & typeof reconciliationSchema;

const schemaInternal: Schema = {
  ...authSchema,
  ...ledgerSchema,
  ...accountingSchema,
  ...partiesSchema,
  ...documentsSchema,
  ...idempotencySchema,
  ...fxSchema,
  ...feesSchema,
  ...currenciesSchema,
  ...organizationsSchema,
  ...balancesSchema,
  ...requisiteProvidersSchema,
  ...reconciliationSchema,
};

export const schema: Schema = schemaInternal;
