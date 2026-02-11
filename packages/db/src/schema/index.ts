import { journalEntries, journalLines } from "./ledger/journal";
import { ledgerAccounts } from "./ledger/ledger";
import { outbox } from "./ledger/outbox";
import { tbTransferPlans } from "./ledger/tb-plan";
import { bankAccounts } from "./treasury/bank-accounts";
import { customers } from "./treasury/customers";
import { paymentOrders } from "./treasury/orders";
import { settlements } from "./treasury/orders";
import { organizations } from "./treasury/organizations";
import { reconciliationExceptions } from "./treasury/reconciliation";
import { fxRates } from "./fx/rates";
import { fxPolicies } from "./fx/policies";
import { fxQuotes } from "./fx/quotes";
import { internalTransfers } from "./transfers/transfers";

export const schema = {
  journalEntries,
  journalLines,
  ledgerAccounts,
  outbox,
  tbTransferPlans,
  organizations,
  customers,
  bankAccounts,
  paymentOrders,
  settlements,
  reconciliationExceptions,
  fxRates,
  fxPolicies,
  fxQuotes,
  internalTransfers,
};

export { TransferStatus } from "./transfers/transfers";
export { type JournalStatus } from "./ledger/journal";
export { type FxQuote, type FxQuoteStatus } from "./fx/quotes";
