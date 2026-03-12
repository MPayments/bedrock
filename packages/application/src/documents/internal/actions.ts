import type { Document } from "@bedrock/application/documents/schema";
import { type Logger } from "@bedrock/common";
import type { Database, Transaction } from "@bedrock/common/db/types";

import {
  collectDocumentCounterpartyIds,
  isCounterpartyPeriodClosed,
} from "../period-locks";
import {
  resolveDocumentAllowedActions,
  type DocumentAction,
} from "../state-machine";
import type {
  DocumentActionPolicyService,
  DocumentModule,
  DocumentRegistry,
  DocumentWithOperationId,
} from "../types";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "./module-resolution";

type Queryable = Database | Transaction;

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

async function isDocumentLockedByCounterpartyPeriod(input: {
  db: Queryable;
  document: Document;
}): Promise<boolean> {
  const counterpartyIds = collectDocumentCounterpartyIds({
    documentCounterpartyId: input.document.counterpartyId,
    payload: input.document.payload,
  });

  for (const counterpartyId of counterpartyIds) {
    const closed = await isCounterpartyPeriodClosed({
      db: input.db,
      counterpartyId,
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
    switch (input.action) {
      case "edit":
        await input.module.canEdit(input.moduleContext, input.document);
        return true;
      case "submit":
        await input.module.canSubmit(input.moduleContext, input.document);
        return true;
      case "approve":
        await input.module.canApprove(input.moduleContext, input.document);
        return true;
      case "reject":
        await input.module.canReject(input.moduleContext, input.document);
        return true;
      case "post":
        if (
          input.module.allowDirectPostFromDraft &&
          input.document.submissionStatus === "draft"
        ) {
          await input.module.canSubmit(input.moduleContext, input.document);
        }
        await input.module.canPost(input.moduleContext, input.document);
        return true;
      case "cancel":
        await input.module.canCancel(input.moduleContext, input.document);
        return true;
      case "repost":
        return true;
      default:
        return false;
    }
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
    const decision =
      input.action === "edit"
        ? await input.policy.canEdit({
            module: input.module,
            document: input.document,
            actorUserId: input.actorUserId,
            moduleContext: input.moduleContext,
          })
        : input.action === "submit"
          ? await input.policy.canSubmit({
              module: input.module,
              document: input.document,
              actorUserId: input.actorUserId,
              moduleContext: input.moduleContext,
            })
          : input.action === "approve"
            ? await input.policy.canApprove({
                module: input.module,
                document: input.document,
                actorUserId: input.actorUserId,
                moduleContext: input.moduleContext,
              })
            : input.action === "reject"
              ? await input.policy.canReject({
                  module: input.module,
                  document: input.document,
                  actorUserId: input.actorUserId,
                  moduleContext: input.moduleContext,
                })
              : input.action === "post"
                ? await (async () => {
                    if (
                      input.module.allowDirectPostFromDraft &&
                      input.document.submissionStatus === "draft"
                    ) {
                      const submitDecision = await input.policy.canSubmit({
                        module: input.module,
                        document: input.document,
                        actorUserId: input.actorUserId,
                        moduleContext: input.moduleContext,
                      });
                      if (!submitDecision.allow) {
                        return submitDecision;
                      }
                    }

                    return input.policy.canPost({
                      module: input.module,
                      document: input.document,
                      actorUserId: input.actorUserId,
                      moduleContext: input.moduleContext,
                    });
                  })()
                : input.action === "cancel"
                  ? await input.policy.canCancel({
                      module: input.module,
                      document: input.document,
                      actorUserId: input.actorUserId,
                      moduleContext: input.moduleContext,
                    })
                  : {
                      allow: true,
                      reasonCode: "allowed",
                      reasonMeta: null,
                    };

    return decision.allow;
  } catch {
    return false;
  }
}

export async function resolveDocumentAllowedActionsForActor(input: {
  registry?: DocumentRegistry;
  policy?: DocumentActionPolicyService;
  db: Queryable;
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

  const periodLocked = await isDocumentLockedByCounterpartyPeriod({
    db: input.db,
    document: input.document,
  });
  const moduleContext = createModuleContext({
    actorUserId: input.actorUserId,
    db: input.db,
    now: new Date(),
    log: input.log,
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
