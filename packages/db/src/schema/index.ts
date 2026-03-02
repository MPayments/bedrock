import {
  schema as accountingSchema,
  type AccountingPackAssignment,
  type AccountingPackVersion,
  type OperationalAccountBinding,
  type OperationalAccountBindingInsert,
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
import {
  schema as balancesSchema,
  type BalanceEvent,
  type BalanceEventInsert,
  type BalanceHold,
  type BalanceHoldInsert,
  type BalanceHoldState,
  type BalancePosition,
  type BalancePositionInsert,
  type BalanceProjectorCursor,
} from "./balances";
import {
  schema as componentRuntimeSchema,
  type PlatformComponentEvent,
  type PlatformComponentEventInsert,
  type PlatformComponentRuntimeMeta,
  type PlatformComponentRuntimeMetaInsert,
  type PlatformComponentScopeType,
  type PlatformComponentState,
  type PlatformComponentStateInsert,
  type PlatformComponentStateRow,
} from "./component-runtime";
import {
  schema as connectorsSchema,
  type ConnectorCursor,
  type ConnectorCursorInsert,
  type ConnectorDirection,
  type ConnectorEvent,
  type ConnectorEventInsert,
  type ConnectorEventParseStatus,
  type ConnectorHealth,
  type ConnectorHealthInsert,
  type ConnectorHealthStatus,
  type ConnectorIntentStatus,
  type ConnectorPaymentIntent,
  type ConnectorPaymentIntentInsert,
  type ConnectorReference,
  type ConnectorReferenceInsert,
  type PaymentAttempt,
  type PaymentAttemptInsert,
  type PaymentAttemptStatus,
} from "./connectors";
import { schema as counterpartiesSchema } from "./counterparties";
import {
  currencies,
  type Currency,
  type CurrencyInsert,
} from "./currencies";
import {
  customers,
  type Customer,
  type CustomerInsert,
} from "./customers";
import {
  schema as documentsSchema,
  type Document,
  type DocumentApprovalStatus,
  type DocumentEvent,
  type DocumentEventInsert,
  type DocumentInsert,
  type DocumentLifecycleStatus,
  type DocumentLink,
  type DocumentLinkInsert,
  type DocumentLinkType,
  type DocumentOperation,
  type DocumentOperationInsert,
  type DocumentPostingStatus,
  type DocumentSnapshot,
  type DocumentSnapshotInsert,
  type DocumentSubmissionStatus,
} from "./documents";
import { schema as feesSchema } from "./fees";
import {
  schema as fxSchema,
  type FxQuote,
  type FxQuoteLeg,
  type FxQuoteStatus,
  type FxRate,
  type FxRateInsert,
  type FxRateSource,
  type FxRateSourceRow,
  type FxRateSourceSyncStatus,
} from "./fx";
import {
  schema as idempotencySchema,
  type ActionReceipt,
  type ActionReceiptInsert,
  type ActionReceiptStatus,
} from "./idempotency";
import {
  schema as ledgerSchema,
  type Dimensions,
  type LedgerOperationStatus,
} from "./ledger";
import {
  schema as operationalAccountsSchema,
  type OperationalAccount,
  type OperationalAccountInsert,
  type OperationalAccountProvider,
  type OperationalAccountProviderInsert,
} from "./operational-accounts";
import {
  schema as orchestrationSchema,
  type OrchestrationScopeOverride,
  type OrchestrationScopeOverrideInsert,
  type ProviderCorridor,
  type ProviderCorridorInsert,
  type ProviderFeeSchedule,
  type ProviderFeeScheduleInsert,
  type ProviderLimit,
  type ProviderLimitInsert,
  type RoutingRule,
  type RoutingRuleInsert,
} from "./orchestration";
import {
  schema as reconciliationSchema,
  type ReconciliationException,
  type ReconciliationExceptionInsert,
  type ReconciliationExceptionState,
  type ReconciliationExternalRecord,
  type ReconciliationExternalRecordInsert,
  type ReconciliationMatch,
  type ReconciliationMatchInsert,
  type ReconciliationMatchStatus,
  type ReconciliationRun,
  type ReconciliationRunInsert,
} from "./reconciliation";

const authSchema = {
  user,
  account,
  session,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
};

export const schema:
  & typeof authSchema
  & typeof ledgerSchema
  & typeof accountingSchema
  & typeof counterpartiesSchema
  & typeof documentsSchema
  & typeof idempotencySchema
  & typeof operationalAccountsSchema
  & typeof fxSchema
  & typeof feesSchema
  & typeof connectorsSchema
  & typeof componentRuntimeSchema
  & typeof orchestrationSchema
  & typeof balancesSchema
  & typeof reconciliationSchema
  & { customers: typeof customers; currencies: typeof currencies } = {
  ...authSchema,
  ...ledgerSchema,
  ...accountingSchema,
  ...counterpartiesSchema,

  customers,
  ...documentsSchema,
  ...idempotencySchema,
  ...operationalAccountsSchema,
  ...fxSchema,
  ...feesSchema,
  currencies,
  ...connectorsSchema,
  ...componentRuntimeSchema,
  ...orchestrationSchema,
  ...balancesSchema,
  ...reconciliationSchema,
};

export type { LedgerOperationStatus };
export type { FxQuote, FxQuoteStatus };
export type { FxQuoteLeg };
export type { FxRateSource, FxRateSourceRow, FxRateSourceSyncStatus };
export type { FxRate, FxRateInsert };
export type {
  ConnectorCursor,
  ConnectorCursorInsert,
  ConnectorDirection,
  ConnectorEvent,
  ConnectorEventInsert,
  ConnectorEventParseStatus,
  ConnectorHealth,
  ConnectorHealthInsert,
  ConnectorHealthStatus,
  ConnectorIntentStatus,
  ConnectorPaymentIntent,
  ConnectorPaymentIntentInsert,
  ConnectorReference,
  ConnectorReferenceInsert,
  PaymentAttempt,
  PaymentAttemptInsert,
  PaymentAttemptStatus,
};
export type { Currency, CurrencyInsert };
export type { Customer, CustomerInsert };
export type {
  BalanceEvent,
  BalanceEventInsert,
  BalanceHold,
  BalanceHoldInsert,
  BalanceProjectorCursor,
  BalanceHoldState,
  BalancePosition,
  BalancePositionInsert,
};
export type { AccountingPackAssignment, AccountingPackVersion };
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
};
export type {
  PlatformComponentEvent,
  PlatformComponentEventInsert,
  PlatformComponentRuntimeMeta,
  PlatformComponentRuntimeMetaInsert,
  PlatformComponentScopeType,
  PlatformComponentState,
  PlatformComponentStateInsert,
  PlatformComponentStateRow,
};
export type {
  OrchestrationScopeOverride,
  OrchestrationScopeOverrideInsert,
  ProviderCorridor,
  ProviderCorridorInsert,
  ProviderFeeSchedule,
  ProviderFeeScheduleInsert,
  ProviderLimit,
  ProviderLimitInsert,
  RoutingRule,
  RoutingRuleInsert,
};
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
};
export type { OperationalAccount, OperationalAccountInsert };
export type { OperationalAccountBinding, OperationalAccountBindingInsert };
export type { OperationalAccountProvider, OperationalAccountProviderInsert };
export type { Dimensions };
