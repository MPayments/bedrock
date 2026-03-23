import type {
  DocumentEventsRepository,
  DocumentOperationsRepository,
  DocumentsCommandRepository,
} from "../../../documents/application/ports";
import type { DocumentModuleRuntime } from "../../../plugins";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface PostingCommandTx {
  moduleRuntime: DocumentModuleRuntime;
  documentsCommand: DocumentsCommandRepository;
  documentEvents: DocumentEventsRepository;
  documentOperations: DocumentOperationsRepository;
}

export type PostingCommandUnitOfWork = UnitOfWork<PostingCommandTx>;
