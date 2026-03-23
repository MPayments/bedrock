import { CreateDraftCommand } from "./commands/create-draft";
import { UpdateDraftCommand } from "./commands/update-draft";
import { GetDocumentQuery } from "./queries/get-document";
import { GetDocumentDetailsQuery } from "./queries/get-document-details";
import { ListDocumentsQuery } from "./queries/list-documents";
import type { DocumentsServiceDeps } from "./service-deps";

export function createDocumentsService(deps: DocumentsServiceDeps) {
  const createDraft = new CreateDraftCommand(
    deps.runtime,
    deps.commandUow,
    deps.accountingPeriods,
    deps.registry,
    deps.policy,
  );
  const updateDraft = new UpdateDraftCommand(
    deps.runtime,
    deps.commandUow,
    deps.accountingPeriods,
    deps.registry,
    deps.policy,
  );
  const listDocuments = new ListDocumentsQuery(
    deps.runtime,
    deps.documentsQuery,
    deps.accountingPeriods,
    deps.moduleRuntime,
    deps.registry,
    deps.policy,
  );
  const getDocument = new GetDocumentQuery(
    deps.runtime,
    deps.documentsQuery,
    deps.accountingPeriods,
    deps.moduleRuntime,
    deps.registry,
    deps.policy,
  );
  const getDocumentDetails = new GetDocumentDetailsQuery(
    deps.runtime,
    deps.accountingPeriods,
    deps.documentEvents,
    deps.documentLinks,
    deps.documentOperations,
    deps.documentSnapshots,
    deps.documentsQuery,
    deps.ledgerReadService,
    deps.moduleRuntime,
    deps.registry,
    deps.policy,
  );

  return {
    commands: {
      createDraft: createDraft.execute.bind(createDraft),
      updateDraft: updateDraft.execute.bind(updateDraft),
    },
    queries: {
      list: listDocuments.execute.bind(listDocuments),
      get: getDocument.execute.bind(getDocument),
      getDetails: getDocumentDetails.execute.bind(getDocumentDetails),
    },
  };
}
