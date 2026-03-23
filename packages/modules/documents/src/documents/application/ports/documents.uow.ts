import type {
  DocumentEventsRepository,
  DocumentLinksRepository,
  DocumentOperationsRepository,
  DocumentsCommandRepository,
} from "./index";
import type { DocumentModuleRuntime } from "../../../plugins";
import type { DocumentsIdempotencyPort } from "../../../shared/application/idempotency.port";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface DocumentsCommandTx {
  moduleRuntime: DocumentModuleRuntime;
  idempotency: DocumentsIdempotencyPort;
  documentsCommand: DocumentsCommandRepository;
  documentEvents: DocumentEventsRepository;
  documentLinks: DocumentLinksRepository;
  documentOperations: DocumentOperationsRepository;
}

export type DocumentsCommandUnitOfWork = UnitOfWork<DocumentsCommandTx>;
