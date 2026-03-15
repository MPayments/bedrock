import { createDocumentsHandlers } from "./application";
import type { DocumentsServiceDeps } from "./application/service-deps";

export function createDocumentsService(deps: DocumentsServiceDeps) {
  return createDocumentsHandlers(deps);
}

export type DocumentsService = ReturnType<typeof createDocumentsService>;
export type { DocumentsServiceContext } from "./application";
