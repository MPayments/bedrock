import { user, account, session, verification, userRelations, sessionRelations, accountRelations } from "./auth";
import { currencies } from "./currencies";
import { customers } from "./customers";
import { fxQuoteFeeComponents } from "./fees/quote-components";
import { feeRules } from "./fees/rules";
import { fxQuoteLegs } from "./fx/quote-legs";
import { fxQuotes } from "./fx/quotes";
import { fxRateSources } from "./fx/rate-sources";
import { fxRates } from "./fx/rates";
import { journalEntries, journalLines } from "./ledger/journal";
import { ledgerAccounts } from "./ledger/ledger";
import { outbox } from "./ledger/outbox";
import { tbTransferPlans } from "./ledger/tb-plan";
import { internalTransfersLegacy, transferEvents, transferOrders } from "./transfers";
import { accountLedgerBindings } from "./treasury/account-ledger-bindings";
import { accountProviders } from "./treasury/account-providers";
import { accounts } from "./treasury/accounts";
import { counterpartyGroupMemberships, counterpartyGroups, counterparties } from "./treasury/counterparties";
import { feePaymentOrders } from "./treasury/fee-payment-orders";
import { paymentOrders } from "./treasury/orders";
import { settlements } from "./treasury/orders";
import { reconciliationExceptions } from "./treasury/reconciliation";

export const schema = {
  user,
  account,
  session,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
  journalEntries,
  journalLines,
  ledgerAccounts,
  outbox,
  tbTransferPlans,
  counterparties,
  counterpartyGroups,
  counterpartyGroupMemberships,
  customers,
  accountLedgerBindings,
  accountProviders,
  accounts,
  paymentOrders,
  settlements,
  reconciliationExceptions,
  fxRates,
  fxRateSources,
  fxQuotes,
  fxQuoteLegs,
  feeRules,
  fxQuoteFeeComponents,
  feePaymentOrders,
  transferOrders,
  transferEvents,
  internalTransfersLegacy,
  currencies,
};

export {
  type TransferEventType,
  type TransferKind,
  type TransferSettlementMode,
  type TransferStatus,
} from "./transfers";
export { type JournalStatus } from "./ledger/journal";
export { type FxQuote, type FxQuoteStatus } from "./fx/quotes";
export { type FxQuoteLeg } from "./fx/quote-legs";
export { type FxRateSource, type FxRateSourceRow, type FxRateSourceSyncStatus, } from "./fx/rate-sources";
export { type FxRate, type FxRateInsert } from "./fx/rates";
export { type FeePaymentOrder, type FeePaymentOrderStatus } from "./treasury/fee-payment-orders";
export type { PaymentOrder } from "./treasury/orders";
export type { Currency, CurrencyInsert } from "./currencies";
export type { Customer, CustomerInsert } from "./customers";
export type { Account, AccountInsert } from "./treasury/accounts";
export type { AccountLedgerBinding, AccountLedgerBindingInsert } from "./treasury/account-ledger-bindings";
export type { AccountProvider, AccountProviderInsert } from "./treasury/account-providers";
