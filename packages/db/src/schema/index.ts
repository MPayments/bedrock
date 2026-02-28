import {
  accountingPackAssignments,
  accountingPackVersions,
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
import { balanceEvents, balanceHolds, balancePositions } from "./balances";
import { currencies } from "./currencies";
import { customers } from "./customers";
import {
  actionReceipts,
  documentEvents,
  documentLinks,
  documentOperations,
  documentSnapshots,
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
import {
  reconciliationExceptions,
  reconciliationExternalRecords,
  reconciliationMatches,
  reconciliationRuns,
} from "./reconciliation";
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
  accountingPackVersions,
  accountingPackAssignments,
  operationalAccountBindings,

  counterparties,
  counterpartyGroups,
  counterpartyGroupMemberships,
  customers,
  actionReceipts,
  documents,
  documentEvents,
  documentOperations,
  documentLinks,
  documentSnapshots,
  operationalAccountProviders,
  operationalAccounts,
  fxRates,
  fxRateSources,
  fxQuotes,
  fxQuoteLegs,
  feeRules,
  fxQuoteFeeComponents,
  currencies,
  balancePositions,
  balanceHolds,
  balanceEvents,
  reconciliationExternalRecords,
  reconciliationRuns,
  reconciliationMatches,
  reconciliationExceptions,
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
  BalanceEvent,
  BalanceEventInsert,
  BalanceHold,
  BalanceHoldInsert,
  BalanceHoldState,
  BalancePosition,
  BalancePositionInsert,
} from "./balances";
export type {
  AccountingPackAssignment,
  AccountingPackVersion,
} from "./accounting";
export type {
  ActionReceipt,
  ActionReceiptInsert,
  ActionReceiptStatus,
  Document,
  DocumentApprovalStatus,
  DocumentEvent,
  DocumentEventInsert,
  DocumentInsert,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentLinkInsert,
  DocumentLinkType,
  DocumentOperation,
  DocumentOperationInsert,
  DocumentPostingStatus,
  DocumentSnapshot,
  DocumentSnapshotInsert,
  DocumentSubmissionStatus,
} from "./documents";
export type {
  ReconciliationException,
  ReconciliationExceptionInsert,
  ReconciliationExceptionState,
  ReconciliationExternalRecord,
  ReconciliationExternalRecordInsert,
  ReconciliationMatch,
  ReconciliationMatchInsert,
  ReconciliationMatchStatus,
  ReconciliationRun,
  ReconciliationRunInsert,
} from "./reconciliation";
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
