import {
  chartAccountDimensionPolicy,
  chartTemplateAccounts,
  correspondenceRules,
  operationalAccountBindings,
  postingCodeDimensionPolicy,
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
import {
  documentLinks,
  documentOperations,
  documents,
} from "./documents";
import { fxQuoteFeeComponents } from "./fees/quote-components";
import { feeRules } from "./fees/rules";
import { fxQuoteLegs } from "./fx/quote-legs";
import { fxQuotes } from "./fx/quotes";
import { fxRateSources } from "./fx/rate-sources";
import { fxRates } from "./fx/rates";
import { ledgerOperations, postings } from "./ledger/journal";
import { bookAccountInstances } from "./ledger/ledger";
import { outbox } from "./ledger/outbox";
import { tbTransferPlans } from "./ledger/tb-plan";
import { operationalAccountProviders } from "./treasury/account-providers";
import { operationalAccounts } from "./treasury/accounts";
import {
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterparties,
} from "./treasury/counterparties";

export const schema = {
  user,
  account,
  session,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,

  ledgerOperations,
  postings,
  bookAccountInstances,

  outbox,
  tbTransferPlans,

  chartTemplateAccounts,
  chartAccountDimensionPolicy,
  postingCodeDimensionPolicy,
  correspondenceRules,
  operationalAccountBindings,

  counterparties,
  counterpartyGroups,
  counterpartyGroupMemberships,
  customers,
  documents,
  documentOperations,
  documentLinks,
  operationalAccountProviders,
  operationalAccounts,
  fxRates,
  fxRateSources,
  fxQuotes,
  fxQuoteLegs,
  feeRules,
  fxQuoteFeeComponents,
  currencies,
};
export { type LedgerOperationStatus } from "./ledger/journal";
export { type FxQuote, type FxQuoteStatus } from "./fx/quotes";
export { type FxQuoteLeg } from "./fx/quote-legs";
export {
  type FxRateSource,
  type FxRateSourceRow,
  type FxRateSourceSyncStatus,
} from "./fx/rate-sources";
export { type FxRate, type FxRateInsert } from "./fx/rates";
export type { Currency, CurrencyInsert } from "./currencies";
export type { Customer, CustomerInsert } from "./customers";
export type {
  Document,
  DocumentApprovalStatus,
  DocumentInsert,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentLinkInsert,
  DocumentLinkType,
  DocumentOperation,
  DocumentOperationInsert,
  DocumentPostingStatus,
  DocumentSubmissionStatus,
} from "./documents";
export type {
  OperationalAccount,
  OperationalAccountInsert,
} from "./treasury/accounts";
export type {
  OperationalAccountBinding,
  OperationalAccountBindingInsert,
} from "./treasury/account-ledger-bindings";
export type {
  OperationalAccountProvider,
  OperationalAccountProviderInsert,
} from "./treasury/account-providers";
export type { Dimensions } from "./ledger/ledger";
