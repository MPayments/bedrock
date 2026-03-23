export * from "./errors";
export { Document } from "./documents/domain/document";
export {
  createDocumentsModule,
  type DocumentsModule,
  type DocumentsModuleDeps,
  type DocumentsModuleUnitOfWork,
} from "./module";
export {
  SYSTEM_ONLY_DOCUMENT_TYPES,
  isSystemOnlyDocumentType,
} from "./documents/domain/doc-type";
export {
  FINANCIAL_LINE_BUCKET_OPTIONS,
  aggregateFinancialLines,
  normalizeFinancialLine,
} from "./documents/application/contracts/dto";
export {
  FINANCIAL_LINE_BUCKETS,
  financialLineBucketSchema,
  financialLineSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema,
} from "./documents/application/contracts/zod";
export {
  DOCUMENT_ACTIONS,
  isDocumentActionAllowed,
  resolveDocumentAllowedActions,
} from "./lifecycle/domain/document-workflow";
export type {
  DocumentApprovalStatus,
  DocumentDraftMetadata,
  DocumentEvent,
  DocumentInitialLink,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentLinkType,
  DocumentOperation,
  DocumentSnapshot,
  DocumentPostingStatus,
  DocumentSubmissionStatus,
} from "./documents/domain/document";
export type { DocumentPostingSnapshot } from "./documents/domain/document";
export type { DocumentSummaryFields } from "./documents/domain/document-summary";
export type {
  FinancialLine,
  FinancialLineBucket,
  FinancialLineSettlementMode,
  FinancialLineSource,
} from "./documents/application/contracts/dto";
export type { DocumentAction } from "./lifecycle/domain/document-workflow";
export type {
  DocumentActionPolicyService,
  DocumentApprovalMode,
  DocumentDraftResult,
  DocumentModule,
  DocumentModuleContext,
  DocumentModuleRuntime,
  DocumentPolicyDecision,
  DocumentRegistry,
  DocumentUpdateDraftResult,
} from "./plugins";
export type {
  DocumentAdjustmentRow,
  DocumentAuditEventRow,
  DocumentOperationRef,
  DocumentsReadModel,
} from "./read-model";
export type {
  DocumentEventsRepository,
} from "./documents/application/ports/document-events.repository";
export type {
  DocumentsCommandTx,
  DocumentsCommandUnitOfWork,
} from "./documents/application/ports/documents.uow";
export type {
  DocumentLinksRepository,
} from "./documents/application/ports/document-links.repository";
export type {
  DocumentOperationsRepository,
} from "./documents/application/ports/document-operations.repository";
export type {
  DocumentSnapshotsRepository,
} from "./documents/application/ports/document-snapshots.repository";
export type {
  DocumentsCommandRepository,
} from "./documents/application/ports/documents-command.repository";
export type {
  DocumentsQueryRepository,
} from "./documents/application/ports/documents-query.repository";
export type { DocumentsRepositoryEventInput } from "./documents/application/ports/document-events.repository";
export type {
  DocumentsAccountingPeriodsPort,
  DocumentsAccountingPort,
  DocumentsLedgerCommitPort,
  DocumentsLedgerReadPort,
  PostingCommandTx,
  PostingCommandUnitOfWork,
  DocumentsPostingWorkerTx,
  DocumentsPostingWorkerUnitOfWork,
} from "./posting/application/ports";
export type {
  LifecycleCommandTx,
  LifecycleCommandUnitOfWork,
} from "./lifecycle/application/ports/lifecycle.uow";
export type {
  FinalizeFailedDocumentPostingInput,
  FinalizePreparedDocumentPostingInput,
  PreparedDocumentPosting,
  ResolveDocumentPostingIdempotencyKeyInput,
} from "./posting/application/commands/types";
export type {
  DocumentsIdempotencyPort,
} from "./shared/application/idempotency.port";
export { DOCUMENTS_IDEMPOTENCY_SCOPE } from "./shared/application/documents-idempotency";
export { createDefaultDocumentActionPolicyService } from "./lifecycle/application/policy/default-action-policy";
export {
  createRuleBasedDocumentActionPolicyService,
  type DocumentApprovalRule,
} from "./lifecycle/application/policy/rule-based-action-policy";
export {
  createAccountingPeriodDocumentTransitionEffectsService,
  createNoopDocumentTransitionEffectsService,
  type DocumentTransitionEffectsInput,
  type DocumentTransitionEffectsService,
  type DocumentTransitionEffectsServices,
} from "./shared/application/transition-effects";
