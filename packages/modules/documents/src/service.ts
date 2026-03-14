import { createCreateDraftHandler } from "./application/commands/create-draft";
import { createTransitionHandler } from "./application/commands/transition";
import { createUpdateDraftHandler } from "./application/commands/update-draft";
import { createValidateAccountingSourceCoverageHandler } from "./application/commands/validate-accounting-source-coverage";
import {
  createDocumentsServiceContext,
  type DocumentsServiceContext,
} from "./application/shared/context";
import { createGetDocumentQuery } from "./application/queries/get-document";
import { createGetDocumentDetailsQuery } from "./application/queries/get-document-details";
import { createListDocumentsQuery } from "./application/queries/list-documents";
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

export type { DocumentsServiceContext };
