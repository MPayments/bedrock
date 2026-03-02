import { operationalAccountBindings } from "./account-ledger-bindings";
import { operationalAccountProviders } from "./account-providers";
import { operationalAccounts } from "./accounts";
import { schema as currenciesSchema } from "../../currencies/schema";
import { schema as ledgerSchema } from "../../ledger/schema";

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
