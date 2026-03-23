import type {
  DocumentEventsRepository,
  DocumentOperationsRepository,
  DocumentsCommandRepository,
} from "../../../documents/application/ports";
import type { DocumentModuleRuntime } from "../../../plugins";
import type { DocumentsIdempotencyPort } from "../../../shared/application/idempotency.port";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface LifecycleCommandTx {
  transaction: unknown;
  moduleRuntime: DocumentModuleRuntime;
  idempotency: DocumentsIdempotencyPort;
  documentsCommand: DocumentsCommandRepository;
  documentEvents: DocumentEventsRepository;
  documentOperations: DocumentOperationsRepository;
}

export type LifecycleCommandUnitOfWork = UnitOfWork<LifecycleCommandTx>;
