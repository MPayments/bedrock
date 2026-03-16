import type { Logger } from "@bedrock/platform/observability/logger";

import {
  invokeDocumentModuleAction,
  resolveDocumentPolicyDecision,
} from "./action-dispatch";
import type { DocumentsServiceContext } from "./context";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "./module-resolution";
import type { DocumentWithOperationId } from "../../contracts/dto";
import type { Document } from "../../domain/document";
import { collectDocumentOrganizationIds } from "../../domain/document-period-scope";
import {
  resolveDocumentAllowedActions,
  type DocumentAction,
} from "../../domain/document-workflow";
import { DocumentNotFoundError } from "../../errors";
import type {
  DocumentActionPolicyService,
  DocumentModule,
  DocumentRegistry,
} from "../../plugins";
import type {
  DocumentOperationsRepository,
  DocumentsCommandRepository,
  DocumentsQueryRepository,
} from "../documents/ports";

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
  return (
    (
      await resolveDocumentPeriodLockMap({
        accountingPeriods: input.accountingPeriods,
        documents: [input.document],
      })
    ).get(input.document.id) ?? false
  );
}

function normalizeMonthStartUtc(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1));
}

function periodKey(input: Date): string {
  return normalizeMonthStartUtc(input).toISOString();
}

async function resolveDocumentPeriodLockMap(input: {
  accountingPeriods: DocumentsServiceContext["accountingPeriods"];
  documents: Document[];
}): Promise<Map<string, boolean>> {
  if (input.documents.length === 0) {
    return new Map();
  }

  const organizationIdsByDocumentId = new Map<string, string[]>();
  const periodBuckets = new Map<
    string,
    {
      occurredAt: Date;
      organizationIds: Set<string>;
    }
  >();

  for (const document of input.documents) {
    const organizationIds = Array.from(
      new Set(
        collectDocumentOrganizationIds({
          payload: document.payload,
        }),
      ),
    );
    organizationIdsByDocumentId.set(document.id, organizationIds);

    if (organizationIds.length === 0) {
      continue;
    }

    const key = periodKey(document.occurredAt);
    const bucket = periodBuckets.get(key) ?? {
      occurredAt: document.occurredAt,
      organizationIds: new Set<string>(),
    };
    for (const organizationId of organizationIds) {
      bucket.organizationIds.add(organizationId);
    }
    periodBuckets.set(key, bucket);
  }

  const closedOrganizationIdsByPeriodKey = new Map<string, Set<string>>();
  await Promise.all(
    [...periodBuckets.entries()].map(async ([key, bucket]) => {
      const closedOrganizationIds =
        await input.accountingPeriods.listClosedOrganizationIdsForPeriod({
          organizationIds: [...bucket.organizationIds],
          occurredAt: bucket.occurredAt,
        });
      closedOrganizationIdsByPeriodKey.set(key, new Set(closedOrganizationIds));
    }),
  );

  return new Map(
    input.documents.map((document) => {
      const closedOrganizationIds =
        closedOrganizationIdsByPeriodKey.get(periodKey(document.occurredAt)) ??
        new Set<string>();
      const organizationIds = organizationIdsByDocumentId.get(document.id) ?? [];

      return [
        document.id,
        organizationIds.some((organizationId) =>
          closedOrganizationIds.has(organizationId),
        ),
      ] as const;
    }),
  );
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
  now: () => Date;
  document: Document;
}): Promise<DocumentAction[]> {
  const periodLocked = await isDocumentLockedByOrganizationPeriod({
    accountingPeriods: input.accountingPeriods,
    document: input.document,
  });

  return resolveDocumentAllowedActionsForActorWithPeriodLock({
    moduleRuntime: input.moduleRuntime,
    registry: input.registry,
    policy: input.policy,
    actorUserId: input.actorUserId,
    log: input.log,
    now: input.now,
    document: input.document,
    periodLocked,
  });
}

async function resolveDocumentAllowedActionsForActorWithPeriodLock(input: {
  moduleRuntime: DocumentsServiceContext["moduleRuntime"];
  registry?: DocumentRegistry;
  policy?: DocumentActionPolicyService;
  actorUserId: string;
  log: Logger;
  now: () => Date;
  document: Document;
  periodLocked: boolean;
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

  const moduleContext = createModuleContext({
    actorUserId: input.actorUserId,
    runtime: input.moduleRuntime,
    now: input.now(),
    log: input.log,
    operationIdempotencyKey: null,
  });

  const filtered: DocumentAction[] = [];
  for (const action of stateActions) {
    if (input.periodLocked && PERIOD_LOCKED_ACTIONS.has(action)) {
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

export async function resolveDocumentsAllowedActionsForActor(input: {
  accountingPeriods: DocumentsServiceContext["accountingPeriods"];
  moduleRuntime: DocumentsServiceContext["moduleRuntime"];
  registry?: DocumentRegistry;
  policy?: DocumentActionPolicyService;
  actorUserId: string;
  log: Logger;
  now: () => Date;
  documents: Document[];
}): Promise<Map<string, DocumentAction[]>> {
  if (input.documents.length === 0) {
    return new Map();
  }

  const periodLockedByDocumentId = await resolveDocumentPeriodLockMap({
    accountingPeriods: input.accountingPeriods,
    documents: input.documents,
  });
  const actionEntries = await Promise.all(
    input.documents.map(async (document) => [
      document.id,
      await resolveDocumentAllowedActionsForActorWithPeriodLock({
        moduleRuntime: input.moduleRuntime,
        registry: input.registry,
        policy: input.policy,
        actorUserId: input.actorUserId,
        log: input.log,
        now: input.now,
        document,
        periodLocked: periodLockedByDocumentId.get(document.id) ?? false,
      }),
    ] as const),
  );

  return new Map(actionEntries);
}

export async function loadDocumentOrThrow(
  repository: Pick<DocumentsQueryRepository, "findDocumentByType"> |
    Pick<DocumentsCommandRepository, "findDocumentByType">,
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
  repositories: {
    documents:
      | Pick<DocumentsQueryRepository, "findDocumentByType">
      | Pick<DocumentsCommandRepository, "findDocumentByType">;
    documentOperations: Pick<DocumentOperationsRepository, "findPostingOperationId">;
  },
  input: {
    docType: string;
    documentId: string;
    postingOperationId?: string | null;
    registry?: DocumentRegistry;
  },
): Promise<DocumentWithOperationId> {
  const document = await loadDocumentOrThrow(repositories.documents, {
    documentId: input.documentId,
    docType: input.docType,
  });

  return buildDocumentWithOperationId({
    registry: input.registry,
    document,
    postingOperationId:
      input.postingOperationId ??
      (await repositories.documentOperations.findPostingOperationId({
        documentId: document.id,
      })),
  });
}
