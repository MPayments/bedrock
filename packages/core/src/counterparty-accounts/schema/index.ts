import { counterpartyAccountBindings } from "./counterparty-account-bindings";
import { counterpartyAccountProviders } from "./counterparty-account-providers";
import { counterpartyAccounts } from "./counterparty-accounts";
import { schema as currenciesSchema } from "../../currencies/schema";
import { schema as ledgerSchema } from "../../ledger/schema";

const { currencies } = currenciesSchema;
const { bookAccountInstances } = ledgerSchema;

export const schema = {
  bookAccountInstances,
  currencies,
  counterpartyAccountBindings,
  counterpartyAccountProviders,
  counterpartyAccounts,
};

export {
  bookAccountInstances,
  currencies,
  counterpartyAccountBindings,
  counterpartyAccountProviders,
  counterpartyAccounts,
};

export {
  type CounterpartyAccountProvider,
  type CounterpartyAccountProviderInsert,
} from "./counterparty-account-providers";
export { type CounterpartyAccount, type CounterpartyAccountInsert } from "./counterparty-accounts";
export {
  type CounterpartyAccountBinding,
  type CounterpartyAccountBindingInsert,
} from "./counterparty-account-bindings";
