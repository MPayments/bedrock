import { createCreateDraftHandler } from "./commands/create-draft";
import { createTransitionHandler } from "./commands/transition";
import { createUpdateDraftHandler } from "./commands/update-draft";
import { createValidateAccountingSourceCoverageHandler } from "./commands/validate-accounting-source-coverage";
import {
  createFinalizeDocumentPostingFailureHandler,
  createFinalizeDocumentPostingSuccessHandler,
  createPrepareDocumentPostHandler,
  createPrepareDocumentRepostHandler,
  createResolveDocumentPostingIdempotencyKeyHandler,
} from "./posting/commands";
import { createGetDocumentQuery } from "./queries/get-document";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createListDocumentsQuery } from "./queries/list-documents";
import type { DocumentsServiceDeps } from "./service-deps";
import {
  createDocumentsServiceContext,
  type DocumentsServiceContext,
} from "./shared/context";

export type DocumentsService = ReturnType<typeof createDocumentsHandlers>;

export function createDocumentsHandlers(
  deps: DocumentsServiceDeps,
): {
  createDraft: ReturnType<typeof createCreateDraftHandler>;
  updateDraft: ReturnType<typeof createUpdateDraftHandler>;
  transition: ReturnType<typeof createTransitionHandler>;
  posting: {
    resolveIdempotencyKey: ReturnType<
      typeof createResolveDocumentPostingIdempotencyKeyHandler
    >;
    preparePost: ReturnType<typeof createPrepareDocumentPostHandler>;
    prepareRepost: ReturnType<typeof createPrepareDocumentRepostHandler>;
    finalizeSuccess: ReturnType<
      typeof createFinalizeDocumentPostingSuccessHandler
    >;
    finalizeFailure: ReturnType<
      typeof createFinalizeDocumentPostingFailureHandler
    >;
  };
  list: ReturnType<typeof createListDocumentsQuery>;
  get: ReturnType<typeof createGetDocumentQuery>;
  getDetails: ReturnType<typeof createGetDocumentDetailsQuery>;
  validateAccountingSourceCoverage: ReturnType<
    typeof createValidateAccountingSourceCoverageHandler
  >;
} {
  const context = createDocumentsServiceContext(deps);

  const createDraft = createCreateDraftHandler(context);
  const updateDraft = createUpdateDraftHandler(context);
  const transition = createTransitionHandler(context);
  const posting = {
    resolveIdempotencyKey: createResolveDocumentPostingIdempotencyKeyHandler(
      context,
    ),
    preparePost: createPrepareDocumentPostHandler(context),
    prepareRepost: createPrepareDocumentRepostHandler(context),
    finalizeSuccess: createFinalizeDocumentPostingSuccessHandler(context),
    finalizeFailure: createFinalizeDocumentPostingFailureHandler(context),
  };
  const list = createListDocumentsQuery(context);
  const get = createGetDocumentQuery(context);
  const getDetails = createGetDocumentDetailsQuery(context);
  const validateAccountingSourceCoverage =
    createValidateAccountingSourceCoverageHandler(context);

  return {
    createDraft,
    updateDraft,
    transition,
    posting,
    list,
    get,
    getDetails,
    validateAccountingSourceCoverage,
  };
}

export type { DocumentsServiceContext };
