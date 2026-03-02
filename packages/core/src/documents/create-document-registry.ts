import type { DocumentModule, DocumentRegistry } from "./types";

export function createDocumentRegistry(
  modules: DocumentModule[],
): DocumentRegistry {
  const byType = new Map(modules.map((module) => [module.docType, module]));

  return {
    getDocumentModules() {
      return modules;
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
