import type { DocumentModule, DocumentRegistry } from "./types";

export function createDocumentRegistry(
  modules: DocumentModule[],
): DocumentRegistry {
  const byType = new Map<string, DocumentModule>();
  for (const module of modules) {
    if (byType.has(module.docType)) {
      throw new Error(`Duplicate document module registration for docType "${module.docType}"`);
    }
    byType.set(module.docType, module);
  }

  return {
    getDocumentModules() {
      return [...byType.values()];
    },
    getDocumentModule(docType: string) {
      const module = byType.get(docType);
      if (!module) {
        throw new Error(`Unknown document module: ${docType}`);
      }

      return module;
    },
  };
}
