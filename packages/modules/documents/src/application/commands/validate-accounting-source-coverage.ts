import { DocumentAccountingSourceCoverageError } from "../../errors";
import type { DocumentsServiceContext } from "../shared/context";

export function createValidateAccountingSourceCoverageHandler(
  context: DocumentsServiceContext,
) {
  return async function validateAccountingSourceCoverage(input?: {
    bookId?: string;
  }) {
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
  };
}
