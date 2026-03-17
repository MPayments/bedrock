import { InvalidStateError } from "@bedrock/shared/core/errors";

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
  type ResolveDocumentPostingIdempotencyKeyInput,
} from "./posting/commands";
import { createGetDocumentQuery } from "./queries/get-document";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createListDocumentsQuery } from "./queries/list-documents";
import type { DocumentTransitionInput } from "../contracts/commands";
import type { DocumentsServiceDeps } from "./service-deps";
import { buildDocumentActionIdempotencyKey } from "./shared/action-runtime";
import {
  createDocumentsServiceContext,
  type DocumentsServiceContext,
} from "./shared/context";

export type DocumentsService = ReturnType<typeof createDocumentsHandlers>;

function createDocumentActions(context: DocumentsServiceContext) {
  const execute = createTransitionHandler(context);
  const resolvePostingIdempotencyKey =
    createResolveDocumentPostingIdempotencyKeyHandler(context);
  const preparePost = createPrepareDocumentPostHandler(context);
  const prepareRepost = createPrepareDocumentRepostHandler(context);
  const finalizeSuccess = createFinalizeDocumentPostingSuccessHandler(context);
  const finalizeFailure = createFinalizeDocumentPostingFailureHandler(context);

  return {
    execute,
    async resolveIdempotencyKey(
      input: Pick<
        DocumentTransitionInput,
        "action" | "docType" | "documentId" | "actorUserId" | "idempotencyKey"
      >,
    ) {
      if (input.action === "post" || input.action === "repost") {
        return resolvePostingIdempotencyKey(
          input as ResolveDocumentPostingIdempotencyKeyInput,
        );
      }

      return (
        input.idempotencyKey ??
        buildDocumentActionIdempotencyKey(input.action, input)
      );
    },
    async prepare(input: DocumentTransitionInput) {
      if (input.action === "post") {
        return preparePost(input);
      }

      if (input.action === "repost") {
        return prepareRepost(input);
      }

      throw new InvalidStateError(
        `Document action "${input.action}" does not support prepare/finalize orchestration`,
      );
    },
    finalizeSuccess,
    finalizeFailure,
  };
}

export function createDocumentsHandlers(
  deps: DocumentsServiceDeps,
): {
  createDraft: ReturnType<typeof createCreateDraftHandler>;
  updateDraft: ReturnType<typeof createUpdateDraftHandler>;
  actions: ReturnType<typeof createDocumentActions>;
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
  const actions = createDocumentActions(context);
  const list = createListDocumentsQuery(context);
  const get = createGetDocumentQuery(context);
  const getDetails = createGetDocumentDetailsQuery(context);
  const validateAccountingSourceCoverage =
    createValidateAccountingSourceCoverageHandler(context);

  return {
    createDraft,
    updateDraft,
    actions,
    list,
    get,
    getDetails,
    validateAccountingSourceCoverage,
  };
}

export type { DocumentsServiceContext };
