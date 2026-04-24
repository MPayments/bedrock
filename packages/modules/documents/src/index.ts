export { createDocumentsService } from "./service";
export type { DocumentsService, DocumentsServiceDeps } from "./service";
export type {
  DocumentBusinessLinksRepository,
  DocumentEventsRepository,
  DocumentLinksRepository,
  DocumentOperationsRepository,
  DocumentSnapshotsRepository,
  DocumentsCommandRepository,
  DocumentsRepositoryEventInput,
  DocumentWithPostingOperationRow as DocumentsRepositoryRow,
  DocumentsQueryRepository,
} from "./application/documents/ports";
export type {
  DocumentsAccountingPeriodsPort,
  DocumentsAccountingPort,
  DocumentsLedgerCommitPort,
  DocumentsLedgerReadPort,
} from "./application/posting/ports";
export type {
  FinalizeFailedDocumentPostingInput,
  FinalizePreparedDocumentPostingInput,
  PreparedDocumentPosting,
  ResolveDocumentPostingIdempotencyKeyInput,
} from "./application/posting/commands";
export { createDocumentsAccountingPeriodsPort } from "./application/posting/accounting-periods.port";
export type { CreateDocumentsAccountingPeriodsPortInput } from "./application/posting/accounting-periods.port";
export type {
  DocumentsIdempotencyPort,
  DocumentsTransactionsPort,
} from "./application/shared/external-ports";
export { DOCUMENTS_IDEMPOTENCY_SCOPE } from "./application/shared/documents-idempotency";
export { createDefaultDocumentActionPolicyService } from "./application/policy/default-action-policy";
export {
  createRuleBasedDocumentActionPolicyService,
  type DocumentApprovalRule,
} from "./application/policy/rule-based-action-policy";
export {
  createAccountingPeriodDocumentTransitionEffectsService,
  createNoopDocumentTransitionEffectsService,
  type DocumentTransitionEffectsInput,
  type DocumentTransitionEffectsService,
  type DocumentTransitionEffectsServices,
} from "./application/shared/transition-effects";
export * from "./errors";
