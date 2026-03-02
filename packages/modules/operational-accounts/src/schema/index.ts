import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";

import { operationalAccountBindings } from "./account-ledger-bindings";
import { operationalAccountProviders } from "./account-providers";
import { operationalAccounts } from "./accounts";

const { currencies } = currenciesSchema;
const { bookAccountInstances } = ledgerSchema;

export const schema = {
  bookAccountInstances,
  currencies,
  operationalAccountBindings,
  operationalAccountProviders,
  operationalAccounts,
};

export {
  bookAccountInstances,
  currencies,
  operationalAccountBindings,
  operationalAccountProviders,
  operationalAccounts,
};

export {
  type OperationalAccountProvider,
  type OperationalAccountProviderInsert,
} from "./account-providers";
export { type OperationalAccount, type OperationalAccountInsert } from "./accounts";
export {
  type OperationalAccountBinding,
  type OperationalAccountBindingInsert,
} from "./account-ledger-bindings";
