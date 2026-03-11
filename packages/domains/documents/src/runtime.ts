import { eq } from "drizzle-orm";

import { schema } from "@multihansa/documents/schema";

import { createCreateDraftHandler } from "./commands/create-draft";
import { createTransitionHandler } from "./commands/transition";
import { createUpdateDraftHandler } from "./commands/update-draft";
import { createValidateAccountingSourceCoverageHandler } from "./commands/validate-accounting-source-coverage";
import { createDocumentsServiceContext } from "./internal/context";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createGetDocumentQuery } from "./queries/get-document";
import { createListDocumentsQuery } from "./queries/list-documents";
import type { DocumentsServiceDeps } from "./types";

export type DocumentsService = ReturnType<typeof createDocumentsService>;

export function createDocumentsService(deps: DocumentsServiceDeps) {
  const context = createDocumentsServiceContext(deps);

  const list = createListDocumentsQuery(context);
  const get = createGetDocumentQuery(context);
  const getDetails = createGetDocumentDetailsQuery(context);
  const createDraft = createCreateDraftHandler(context);
  const updateDraft = createUpdateDraftHandler(context);
  const transition = createTransitionHandler(context);
  const validateAccountingSourceCoverage =
    createValidateAccountingSourceCoverageHandler(context);

  async function hasDocument(documentId: string) {
    const [document] = await context.db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(eq(schema.documents.id, documentId))
      .limit(1);

    return document !== undefined;
  }

  return {
    list,
    get,
    getDetails,
    createDraft,
    updateDraft,
    transition,
    validateAccountingSourceCoverage,
    hasDocument,
  };
}

export { createDocumentRegistry } from "./create-document-registry";
export { DOCUMENTS_WORKER_DESCRIPTOR, createDocumentsWorker } from "./workers";
export { createDefaultDocumentActionPolicyService } from "./policy";
export {
  assertCounterpartyPeriodsOpen,
  closeCounterpartyPeriod,
  collectDocumentCounterpartyIds,
  getPreviousCalendarMonthRange,
  isCounterpartyPeriodClosed,
  reopenCounterpartyPeriod,
} from "./period-locks";
export type * from "./types";
