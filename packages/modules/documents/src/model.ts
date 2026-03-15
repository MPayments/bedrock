export {
  DOCUMENT_ACTIONS,
  isDocumentActionAllowed,
  resolveDocumentAllowedActions,
} from "./domain/document-workflow";
export type { DocumentAction } from "./domain/document-workflow";

export {
  SYSTEM_ONLY_DOCUMENT_TYPES,
  isSystemOnlyDocumentType,
} from "./domain/doc-type";
export {
  FINANCIAL_LINE_BUCKET_OPTIONS,
  FINANCIAL_LINE_BUCKETS,
  aggregateFinancialLines,
  financialLineBucketSchema,
  financialLineSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema,
  normalizeFinancialLine,
} from "./contracts/financial-lines";
export type {
  FinancialLine,
  FinancialLineBucket,
  FinancialLineSettlementMode,
  FinancialLineSource,
} from "./contracts/financial-lines";

export type { DocumentSummaryFields } from "./domain/document-summary";
export type {
  Document,
  DocumentApprovalStatus,
  DocumentEvent,
  DocumentInitialLink,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentLinkType,
  DocumentOperation,
  DocumentPostingStatus,
  DocumentSubmissionStatus,
} from "./domain/document";
export type {
  DocumentPostingSnapshot as DocumentSnapshot,
} from "./domain/document";
