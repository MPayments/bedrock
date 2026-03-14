import {
  createDocumentsHandlers,
  type DocumentsService,
  type DocumentsServiceContext,
} from "./application";
import type { DocumentsServiceDeps } from "./types";

export function createDocumentsService(deps: DocumentsServiceDeps) {
  return createDocumentsHandlers(deps);
}

export type { DocumentsService };
export type { DocumentsServiceContext };
