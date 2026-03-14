import type { DocumentsServiceDeps } from "../types";
import { createCreateDraftHandler } from "./commands/create-draft";
import { createTransitionHandler } from "./commands/transition";
import { createUpdateDraftHandler } from "./commands/update-draft";
import { createValidateAccountingSourceCoverageHandler } from "./commands/validate-accounting-source-coverage";
import { createGetDocumentQuery } from "./queries/get-document";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createListDocumentsQuery } from "./queries/list-documents";
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
