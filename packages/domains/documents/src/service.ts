import { createCreateDraftHandler } from "./commands/create-draft";
import { createTransitionHandler } from "./commands/transition";
import { createUpdateDraftHandler } from "./commands/update-draft";
import { createValidateAccountingSourceCoverageHandler } from "./commands/validate-accounting-source-coverage";
import {
  createDocumentsServiceContext,
  type DocumentsServiceContext,
} from "./internal/context";
import { createGetDocumentQuery } from "./queries/get-document";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createListDocumentsQuery } from "./queries/list-documents";
import type { DocumentsServiceDeps } from "./types";

export type DocumentsService = ReturnType<typeof createDocumentsService>;

export function createDocumentsService(deps: DocumentsServiceDeps) {
  const context = createDocumentsServiceContext(deps);

  const createDraft = createCreateDraftHandler(context);
  const updateDraft = createUpdateDraftHandler(context);
  const transition = createTransitionHandler(context);
  const list = createListDocumentsQuery(context);
  const get = createGetDocumentQuery(context);
  const getDetails = createGetDocumentDetailsQuery(context);
  const validateAccountingSourceCoverage =
    createValidateAccountingSourceCoverageHandler(context);

  return {
    createDraft,
    updateDraft,
    transition,
    list,
    get,
    getDetails,
    validateAccountingSourceCoverage,
  };
}
