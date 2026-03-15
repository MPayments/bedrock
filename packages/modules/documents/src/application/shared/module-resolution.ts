import type { DocumentPostingPlan } from "@bedrock/accounting";
import { InvalidStateError } from "@bedrock/shared/core/errors";

import type { Document } from "../../domain/document";
import { DocumentRegistryError } from "../../errors";
import type {
  DocumentModule,
  DocumentModuleContext,
  DocumentRegistry,
} from "../../plugins";

export function resolveModule(
  registry: DocumentRegistry,
  docType: string,
): DocumentModule {
  try {
    return registry.getDocumentModule(docType);
  } catch (error) {
    throw new DocumentRegistryError(
      `Document module is not registered for docType=${docType}`,
      error,
    );
  }
}

export function resolveModuleForDocument(
  registry: DocumentRegistry,
  document: Pick<Document, "docType" | "moduleId" | "moduleVersion">,
): DocumentModule {
  const byType = resolveModule(registry, document.docType);
  const byTypeIdentity = resolveDocumentModuleIdentity(byType);
  if (
    byTypeIdentity.moduleId === document.moduleId &&
    byTypeIdentity.moduleVersion === document.moduleVersion
  ) {
    return byType;
  }
  if (typeof registry.getDocumentModules !== "function") {
    return byType;
  }

  const byStoredIdentity = registry.getDocumentModules().find((candidate) => {
    const identity = resolveDocumentModuleIdentity(candidate);
    return (
      identity.moduleId === document.moduleId &&
      identity.moduleVersion === document.moduleVersion
    );
  });

  if (byStoredIdentity) {
    return byStoredIdentity;
  }

  throw new DocumentRegistryError(
    `Document module mismatch for docType=${document.docType}: stored=${document.moduleId}@${document.moduleVersion}, active=${byTypeIdentity.moduleId}@${byTypeIdentity.moduleVersion}`,
  );
}

export function createModuleContext(
  deps: Pick<
    DocumentModuleContext,
    "actorUserId" | "log" | "now" | "runtime"
  > & {
    operationIdempotencyKey?: string | null;
  },
): DocumentModuleContext {
  return {
    ...deps,
    operationIdempotencyKey: deps.operationIdempotencyKey ?? null,
  };
}

export function resolveDocumentModuleIdentity(module: DocumentModule) {
  return {
    moduleId: module.moduleId ?? module.docType,
    moduleVersion: module.moduleVersion ?? 1,
  };
}

export async function resolveDocumentAccountingSourceId(input: {
  module: DocumentModule;
  moduleContext: DocumentModuleContext;
  document: Document;
  postingPlan: DocumentPostingPlan;
}) {
  const configured =
    (await input.module.resolveAccountingSourceId?.(
      input.moduleContext,
      input.document,
      input.postingPlan,
    )) ??
    input.module.accountingSourceId ??
    input.module.moduleId ??
    input.module.docType;

  const accountingSourceId = configured.trim();
  if (accountingSourceId.length === 0) {
    throw new InvalidStateError(
      `Document module ${input.module.docType} resolved an empty accountingSourceId`,
    );
  }

  return accountingSourceId;
}
