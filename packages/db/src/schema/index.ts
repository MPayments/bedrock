import { currencies } from "./currencies";
import { customers } from "./customers";
import { fxQuoteFeeComponents } from "./fees/quote-components";
import { feeRules } from "./fees/rules";
import { fxQuoteLegs } from "./fx/quote-legs";
import { fxQuotes } from "./fx/quotes";
import { fxRates } from "./fx/rates";
import { journalEntries, journalLines } from "./ledger/journal";
import { ledgerAccounts } from "./ledger/ledger";
import { outbox } from "./ledger/outbox";
import { tbTransferPlans } from "./ledger/tb-plan";
import { internalTransfers } from "./transfers";
import { bankAccounts } from "./treasury/bank-accounts";
import { feePaymentOrders } from "./treasury/fee-payment-orders";
import { paymentOrders } from "./treasury/orders";
import { settlements } from "./treasury/orders";
import { organizations } from "./treasury/organizations";
import { reconciliationExceptions } from "./treasury/reconciliation";

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
  fxQuotes,
  fxQuoteLegs,
  feeRules,
  fxQuoteFeeComponents,
  feePaymentOrders,
  internalTransfers,
  currencies,
};

export { TransferStatus } from "./transfers";
export { type JournalStatus } from "./ledger/journal";
export { type FxQuote, type FxQuoteStatus } from "./fx/quotes";
export { type FeePaymentOrder, type FeePaymentOrderStatus } from "./treasury/fee-payment-orders";
export type { PaymentOrder } from "./treasury/orders";
export type { Currency, CurrencyInsert } from "./currencies";