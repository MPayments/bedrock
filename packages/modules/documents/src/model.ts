export {
  DOCUMENT_ACTIONS,
  isDocumentActionAllowed,
  resolveDocumentAllowedActions,
} from "./domain/state-machine";
export type { DocumentAction } from "./domain/state-machine";

export {
  SYSTEM_ONLY_DOCUMENT_TYPES,
  isSystemOnlyDocumentType,
} from "./domain/doc-type-rules";

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
  DocumentSnapshot,
  DocumentSubmissionStatus,
} from "./domain/types";
