import {
  chartTemplateAccountAnalytics,
  chartTemplateAccounts,
  correspondenceRules,
  operationalAccountsBookBindings,
} from "./accounting";
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "./auth";
import { currencies } from "./currencies";
import { customers } from "./customers";
import { fxQuoteFeeComponents } from "./fees/quote-components";
import { feeRules } from "./fees/rules";
import { fxQuoteLegs } from "./fx/quote-legs";
import { fxQuotes } from "./fx/quotes";
import { fxRateSources } from "./fx/rate-sources";
import { fxRates } from "./fx/rates";
import { ledgerOperations, ledgerPostings } from "./ledger/journal";
import { bookAccounts } from "./ledger/ledger";
import { outbox } from "./ledger/outbox";
import { tbTransferPlans } from "./ledger/tb-plan";
import { transferEvents, transferOrders } from "./transfers";
import { operationalAccountProviders } from "./treasury/account-providers";
import { operationalAccounts } from "./treasury/accounts";
import {
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterparties,
} from "./treasury/counterparties";
import { feePaymentOrders } from "./treasury/fee-payment-orders";
import { paymentOrders, settlements } from "./treasury/orders";
import { reconciliationExceptions } from "./treasury/reconciliation";

export const schema = {
  user,
  account,
  session,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,

  ledgerOperations,
  ledgerPostings,
  bookAccounts,

  outbox,
  tbTransferPlans,

  chartTemplateAccounts,
  chartTemplateAccountAnalytics,
  correspondenceRules,
  operationalAccountsBookBindings,
  operationalAccountBindings: operationalAccountsBookBindings,

  counterparties,
  counterpartyGroups,
  counterpartyGroupMemberships,
  customers,
  operationalAccountProviders,
  accountProviders: operationalAccountProviders,
  operationalAccounts,
  accounts: operationalAccounts,
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
  currencies,
};

export {
  type TransferEventType,
  type TransferKind,
  type TransferSettlementMode,
  type TransferStatus,
} from "./transfers";
export { type LedgerOperationStatus } from "./ledger/journal";
export { type FxQuote, type FxQuoteStatus } from "./fx/quotes";
export { type FxQuoteLeg } from "./fx/quote-legs";
export {
  type FxRateSource,
  type FxRateSourceRow,
  type FxRateSourceSyncStatus,
} from "./fx/rate-sources";
export { type FxRate, type FxRateInsert } from "./fx/rates";
export {
  type FeePaymentOrder,
  type FeePaymentOrderStatus,
} from "./treasury/fee-payment-orders";
export type { PaymentOrder } from "./treasury/orders";
export type { Currency, CurrencyInsert } from "./currencies";
export type { Customer, CustomerInsert } from "./customers";
export type {
  OperationalAccount,
  OperationalAccountInsert,
  Account,
  AccountInsert,
} from "./treasury/accounts";
export type {
  OperationalAccountsBookBinding,
  OperationalAccountsBookBindingInsert,
  OperationalAccountBinding,
  OperationalAccountBindingInsert,
} from "./treasury/account-ledger-bindings";
export type {
  OperationalAccountProvider,
  OperationalAccountProviderInsert,
  AccountProvider,
  AccountProviderInsert,
} from "./treasury/account-providers";
