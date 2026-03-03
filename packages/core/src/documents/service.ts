import { createCreateDraftHandler } from "./commands/create-draft";
import { createTransitionHandler } from "./commands/transition";
import { createUpdateDraftHandler } from "./commands/update-draft";
import { DocumentAccountingSourceCoverageError } from "./errors";
import {
  createDocumentsServiceContext,
  type DocumentsServiceContext,
} from "./internal/context";
import { createGetDocumentQuery } from "./queries/get-document";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createListDocumentsQuery } from "./queries/list-documents";
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

  async function validateAccountingSourceCoverage(input?: { bookId?: string }) {
    const compiledPack = input?.bookId
      ? await context.accounting.loadActiveCompiledPackForBook({
          bookId: input.bookId,
        })
      : context.accounting.getDefaultCompiledPack();
    const allowedSources = new Set<string>();
    for (const template of compiledPack.templates) {
      for (const sourceId of template.allowSources) {
        allowedSources.add(sourceId);
      }
    }

    const missing: string[] = [];
    for (const module of context.registry.getDocumentModules()) {
      const declaredSources = module.accountingSourceIds ?? [
        module.accountingSourceId ?? module.moduleId ?? module.docType,
      ];
      for (const sourceId of declaredSources) {
        const normalized = sourceId.trim();
        if (!allowedSources.has(normalized)) {
          missing.push(`${module.docType}:${normalized}`);
        }
      }
    }

    if (missing.length > 0) {
      throw new DocumentAccountingSourceCoverageError(
        compiledPack.checksum,
        missing.sort((left, right) => left.localeCompare(right)),
      );
    }

    return {
      packChecksum: compiledPack.checksum,
      validatedSources: [...allowedSources].sort((left, right) =>
        left.localeCompare(right),
      ),
    };
  }

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
