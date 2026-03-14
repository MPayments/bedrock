import type { Logger } from "@bedrock/platform/observability/logger";

import {
  invokeDocumentModuleAction,
  resolveDocumentPolicyDecision,
} from "./action-dispatch";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "./module-resolution";
import type { DocumentWithOperationId } from "../../contracts/service";
import { collectDocumentOrganizationIds } from "../../domain/accounting-periods";
import {
  resolveDocumentAllowedActions,
  type DocumentAction,
} from "../../domain/state-machine";
import type { Document } from "../../domain/types";
import { DocumentNotFoundError } from "../../errors";
import type { DocumentsRepository } from "../ports";
import type { DocumentsServiceContext } from "./context";
import type {
  DocumentActionPolicyService,
  DocumentModule,
  DocumentRegistry,
} from "../../plugins";

export function resolveDocumentAllowedActionsForDocument(input: {
  registry?: DocumentRegistry;
  document: Document;
}) {
  let module: DocumentModule | null = null;
  if (input.registry) {
    try {
      module = resolveModuleForDocument(input.registry, input.document);
    } catch {
      module = null;
    }
  }
  if (!module) {
    return [];
  }

  return resolveDocumentAllowedActions({
    document: input.document,
    module: {
      postingRequired: module.postingRequired,
      allowDirectPostFromDraft: module.allowDirectPostFromDraft,
    },
  });
}

export function buildDocumentWithOperationId(input: {
  registry?: DocumentRegistry;
  document: Document;
  postingOperationId: string | null;
}): DocumentWithOperationId {
  return {
    document: input.document,
    postingOperationId: input.postingOperationId,
    allowedActions: resolveDocumentAllowedActionsForDocument({
      registry: input.registry,
      document: input.document,
    }),
  };
}

const PERIOD_LOCKED_ACTIONS = new Set<DocumentAction>([
  "edit",
  "submit",
  "post",
  "cancel",
  "repost",
]);

async function isDocumentLockedByOrganizationPeriod(input: {
  accountingPeriods: DocumentsServiceContext["accountingPeriods"];
  document: Document;
}): Promise<boolean> {
  const organizationIds = collectDocumentOrganizationIds({
    payload: input.document.payload,
  });

  for (const organizationId of organizationIds) {
    const closed = await input.accountingPeriods.isOrganizationPeriodClosed({
      organizationId,
      occurredAt: input.document.occurredAt,
    });
    if (closed) {
      return true;
    }
  }

  return false;
}

async function isActionAllowedByModule(input: {
  action: DocumentAction;
  module: DocumentModule;
  moduleContext: ReturnType<typeof createModuleContext>;
  document: Document;
}): Promise<boolean> {
  try {
    await invokeDocumentModuleAction(input);
    return true;
  } catch {
    return false;
  }
}

async function isActionAllowedByPolicy(input: {
  action: DocumentAction;
  policy: DocumentActionPolicyService;
  module: DocumentModule;
  moduleContext: ReturnType<typeof createModuleContext>;
  document: Document;
  actorUserId: string;
}): Promise<boolean> {
  try {
    const decision = await resolveDocumentPolicyDecision({
      policy: input.policy,
      action: input.action,
      module: input.module,
      actorUserId: input.actorUserId,
      moduleContext: input.moduleContext,
      document: input.document,
    });

    return decision.allow;
  } catch {
    return false;
  }
}

export async function resolveDocumentAllowedActionsForActor(input: {
  accountingPeriods: DocumentsServiceContext["accountingPeriods"];
  moduleRuntime: DocumentsServiceContext["moduleRuntime"];
  registry?: DocumentRegistry;
  policy?: DocumentActionPolicyService;
  actorUserId: string;
  log: Logger;
  document: Document;
}): Promise<DocumentAction[]> {
  let module: DocumentModule | null = null;
  if (input.registry) {
    try {
      module = resolveModuleForDocument(input.registry, input.document);
    } catch (error) {
      input.log.warn("documents allowed actions: module resolution failed", {
        documentId: input.document.id,
        docType: input.document.docType,
        moduleId: input.document.moduleId,
        moduleVersion: input.document.moduleVersion,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  if (!module) {
    return [];
  }

  const stateActions = resolveDocumentAllowedActions({
    document: input.document,
    module: {
      postingRequired: module.postingRequired,
      allowDirectPostFromDraft: module.allowDirectPostFromDraft,
    },
  });

  if (stateActions.length === 0) {
    return [];
  }

  const periodLocked = await isDocumentLockedByOrganizationPeriod({
    accountingPeriods: input.accountingPeriods,
    document: input.document,
  });
  const moduleContext = createModuleContext({
    actorUserId: input.actorUserId,
    runtime: input.moduleRuntime,
    now: new Date(),
    log: input.log,
    operationIdempotencyKey: null,
  });

  const filtered: DocumentAction[] = [];
  for (const action of stateActions) {
    if (periodLocked && PERIOD_LOCKED_ACTIONS.has(action)) {
      continue;
    }

    const moduleAllowed = await isActionAllowedByModule({
      action,
      module,
      moduleContext,
      document: input.document,
    });
    if (!moduleAllowed) {
      continue;
    }

    if (input.policy) {
      const policyAllowed = await isActionAllowedByPolicy({
        action,
        policy: input.policy,
        module,
        moduleContext,
        document: input.document,
        actorUserId: input.actorUserId,
      });
      if (!policyAllowed) {
        continue;
      }
    }

    filtered.push(action);
  }

  return filtered;
}

export async function loadDocumentOrThrow(
  repository: DocumentsRepository,
  input: {
    documentId: string;
    docType: string;
    forUpdate?: boolean;
  },
): Promise<Document> {
  const document = await repository.findDocumentByType(input);
  if (!document) {
    throw new DocumentNotFoundError(input.documentId);
  }

  return document;
}

export async function loadDocumentWithOperationId(
  repository: DocumentsRepository,
  input: {
    docType: string;
    documentId: string;
    postingOperationId?: string | null;
    registry?: DocumentRegistry;
  },
): Promise<DocumentWithOperationId> {
  const document = await loadDocumentOrThrow(repository, {
    documentId: input.documentId,
    docType: input.docType,
  });

  return buildDocumentWithOperationId({
    registry: input.registry,
    document,
    postingOperationId:
      input.postingOperationId ??
      (await repository.findPostingOperationId({ documentId: document.id })),
  });
}
