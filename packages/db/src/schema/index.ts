import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { schema as currenciesSchema } from "@bedrock/assets/schema";
import { schema as balancesSchema } from "@bedrock/balances/schema";
import { schema as documentsSchema } from "@bedrock/documents/schema";
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
} from "@bedrock/identity/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { schema as moduleRuntimeSchema } from "@bedrock/modules/schema";
import { schema as idempotencySchema } from "@bedrock/operations/schema";
import { schema as reconciliationSchema } from "@bedrock/reconciliation/schema";

import { schema as accountingReportingSchema } from "@multihansa/accounting-reporting/schema";
import { schema as counterpartiesSchema } from "@multihansa/counterparties/schema";
import { schema as customersSchema } from "@multihansa/customers/schema";
import { schema as feesSchema } from "@multihansa/fees/schema";
import { schema as fxSchema } from "@multihansa/fx/schema";
import { schema as organizationsSchema } from "@multihansa/organizations/schema";
import { schema as requisiteProvidersSchema } from "@multihansa/requisite-providers/schema";
import { schema as requisitesSchema } from "@multihansa/requisites/schema";

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

type DatabaseSchema = typeof authSchema &
  typeof ledgerSchema &
  typeof accountingSchema &
  typeof accountingReportingSchema &
  typeof counterpartiesSchema &
  typeof customersSchema &
  typeof documentsSchema &
  typeof idempotencySchema &
  typeof fxSchema &
  typeof feesSchema &
  typeof currenciesSchema &
  typeof moduleRuntimeSchema &
  typeof organizationsSchema &
  typeof requisiteProvidersSchema &
  typeof balancesSchema &
  typeof requisitesSchema &
  typeof reconciliationSchema;

const schemaInternal: DatabaseSchema = {
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

export const schema: DatabaseSchema = schemaInternal;
