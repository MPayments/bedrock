export {
  DOCUMENT_APPROVAL_STATUSES,
  DOCUMENT_LIFECYCLE_STATUSES,
  DOCUMENT_POSTING_STATUSES,
  DOCUMENT_SUBMISSION_STATUSES,
  DOCUMENTS_LIST_CONTRACT,
  CreateDocumentInputSchema,
  ListDocumentsQuerySchema,
  UpdateDocumentInputSchema,
  validateInput,
} from "./validation";

export type { ListDocumentsQuery } from "./validation";

export {
  FINANCIAL_LINE_BUCKET_OPTIONS,
  FINANCIAL_LINE_BUCKETS,
  aggregateFinancialLines,
  financialLineBucketSchema,
  financialLineSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema,
  normalizeFinancialLine,
} from "./financial-lines";
export type {
  FinancialLine,
  FinancialLineBucket,
  FinancialLineSettlementMode,
  FinancialLineSource,
} from "./financial-lines";

export {
  DOCUMENT_ACTIONS,
  isDocumentActionAllowed,
  resolveDocumentAllowedActions,
} from "../domain/state-machine";
export type { DocumentAction } from "../domain/state-machine";

export {
  SYSTEM_ONLY_DOCUMENT_TYPES,
  isSystemOnlyDocumentType,
} from "../domain/doc-type-rules";

export type {
  Document,
  DocumentApprovalStatus,
  DocumentEvent,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentLinkType,
  DocumentOperation,
  DocumentPostingStatus,
  DocumentSnapshot,
  DocumentSubmissionStatus,
} from "../domain/types";
export type {
  DocumentDetails,
  DocumentRequestContext,
  DocumentTransitionAction,
  DocumentTransitionInput,
  DocumentWithOperationId,
} from "../types";
