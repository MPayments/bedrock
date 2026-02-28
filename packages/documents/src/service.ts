import { createApproveHandler } from "./commands/approve";
import { createCancelHandler } from "./commands/cancel";
import { createCreateDraftHandler } from "./commands/create-draft";
import { createPostHandler } from "./commands/post";
import { createRepostHandler } from "./commands/repost";
import { createRejectHandler } from "./commands/reject";
import { createSubmitHandler } from "./commands/submit";
import { createUpdateDraftHandler } from "./commands/update-draft";
import { createDocumentsServiceContext, type DocumentsServiceContext } from "./internal/context";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createGetDocumentQuery } from "./queries/get-document";
import { createListDocumentsQuery } from "./queries/list-documents";
import type { DocumentsServiceDeps } from "./types";

export type DocumentsService = ReturnType<typeof createDocumentsService>;

export function createDocumentsService(deps: DocumentsServiceDeps) {
  const context = createDocumentsServiceContext(deps);

  const createDraft = createCreateDraftHandler(context);
  const updateDraft = createUpdateDraftHandler(context);
  const submit = createSubmitHandler(context);
  const approve = createApproveHandler(context);
  const reject = createRejectHandler(context);
  const post = createPostHandler(context);
  const repost = createRepostHandler(context);
  const cancel = createCancelHandler(context);
  const list = createListDocumentsQuery(context);
  const get = createGetDocumentQuery(context);
  const getDetails = createGetDocumentDetailsQuery(context);

  return {
    createDraft,
    updateDraft,
    submit,
    approve,
    reject,
    post,
    repost,
    cancel,
    list,
    get,
    getDetails,
  };
}

export type { DocumentsServiceContext };
