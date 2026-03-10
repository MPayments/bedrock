import { schema as documentsSchema } from "@bedrock/documents/schema";
import { schema as accountingSchema } from "@bedrock/finance/accounting/schema";
import { schema as currenciesSchema } from "@bedrock/finance/assets/schema";
import { schema as balancesSchema } from "@bedrock/finance/balances/schema";
import { schema as ledgerSchema } from "@bedrock/finance/ledger/schema";
import { schema as reconciliationSchema } from "@bedrock/finance/reconciliation/schema";
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
} from "@bedrock/platform/identity/schema";
import { schema as idempotencySchema } from "@bedrock/platform/operations/schema";

import { schema as counterpartiesSchema } from "@multihansa/parties/counterparties/schema";
import { schema as customersSchema } from "@multihansa/parties/customers/schema";
import { schema as organizationsSchema } from "@multihansa/parties/organizations/schema";
import { schema as requisiteProvidersSchema } from "@multihansa/parties/requisite-providers/schema";
import { schema as requisitesSchema } from "@multihansa/parties/requisites/schema";
import { schema as accountingReportingSchema } from "@multihansa/reporting/accounting-reporting/schema";
import { schema as feesSchema } from "@multihansa/treasury/fees/schema";
import { schema as fxSchema } from "@multihansa/treasury/fx/schema";

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
  ...organizationsSchema,
  ...requisiteProvidersSchema,
  ...balancesSchema,
  ...requisitesSchema,
  ...reconciliationSchema,
};

export const schema: DatabaseSchema = schemaInternal;
