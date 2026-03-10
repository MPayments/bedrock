import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { canonicalJson, sha256Hex, type Logger } from "@bedrock/common";
import { InvalidStateError } from "@bedrock/common/errors";
import { pgNotify } from "@bedrock/common/sql/drizzle";
import type { Database, Transaction } from "@bedrock/common/sql/ports";
import { schema, type Document, type DocumentLinkType } from "@bedrock/documents/schema";
import type { DocumentPostingPlan } from "@bedrock/finance/accounting";

import {
  DocumentGraphError,
  DocumentNotFoundError,
  DocumentRegistryError,
} from "../errors";
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
  DocumentInitialLink,
  DocumentModule,
  DocumentModuleContext,
  DocumentRegistry,
  DocumentSummaryFields,
  DocumentWithOperationId,
} from "../types";

type Queryable = Database | Transaction;

export function buildDocNo(prefix: string, documentId: string) {
  return `${prefix}-${documentId.slice(0, 8).toUpperCase()}`;
}

export function assertDocumentIsActive(document: Document, action: string) {
  if (document.lifecycleStatus !== "active") {
    throw new InvalidStateError(
      `Only active documents can be ${action}`,
    );
  }
}

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function buildSummary(summary: DocumentSummaryFields) {
  return {
    title: summary.title,
    amountMinor: summary.amountMinor ?? null,
    currency: summary.currency ?? null,
    memo: summary.memo ?? null,
    counterpartyId: summary.counterpartyId ?? null,
    customerId: summary.customerId ?? null,
    organizationRequisiteId: summary.organizationRequisiteId ?? null,
    searchText: normalizeSearchText(summary.searchText),
  };
}

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

export function resolveModuleOrNull(
  registry: DocumentRegistry,
  docType: string,
): DocumentModule | null {
  try {
    return registry.getDocumentModule(docType);
  } catch {
    return null;
  }
}

export function createModuleContext(
  deps: Pick<DocumentModuleContext, "actorUserId" | "db" | "log" | "now">,
): DocumentModuleContext {
  return deps;
}

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
  moduleContext: DocumentModuleContext;
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
  moduleContext: DocumentModuleContext;
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

export function createDocumentInsertBase(params: {
  id?: string;
  docType: string;
  docNoPrefix: string;
  moduleId: string;
  moduleVersion: number;
  payloadVersion: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
  createIdempotencyKey: string;
  createdBy: string;
  approvalStatus: Document["approvalStatus"];
  postingStatus: Document["postingStatus"];
}) {
  const id = params.id ?? randomUUID();
  return {
    id,
    docType: params.docType,
    docNo: buildDocNo(params.docNoPrefix, id),
    moduleId: params.moduleId,
    moduleVersion: params.moduleVersion,
    payloadVersion: params.payloadVersion,
    payload: params.payload,
    title: "",
    occurredAt: params.occurredAt,
    submissionStatus: "draft" as const,
    approvalStatus: params.approvalStatus,
    postingStatus: params.postingStatus,
    lifecycleStatus: "active" as const,
    createIdempotencyKey: params.createIdempotencyKey,
    amountMinor: null,
    currency: null,
    memo: null,
    counterpartyId: null,
    customerId: null,
    organizationRequisiteId: null,
    searchText: "",
    createdBy: params.createdBy,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    postingStartedAt: null,
    postedAt: null,
    postingError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  } satisfies Document;
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

export async function lockDocument(
  db: Queryable,
  documentId: string,
  docType: string,
): Promise<Document> {
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(
      and(eq(schema.documents.id, documentId), eq(schema.documents.docType, docType)),
    )
    .for("update")
    .limit(1);

  if (!document) {
    throw new DocumentNotFoundError(documentId);
  }

  return document;
}

export async function getDocumentOrNull(
  db: Queryable,
  documentId: string,
  docType: string,
) {
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(
      and(eq(schema.documents.id, documentId), eq(schema.documents.docType, docType)),
    )
    .limit(1);

  return document ?? null;
}

export async function getDocumentByCreateIdempotencyKey(
  db: Queryable,
  docType: string,
  createIdempotencyKey: string,
) {
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.docType, docType),
        eq(schema.documents.createIdempotencyKey, createIdempotencyKey),
      ),
    )
    .limit(1);

  return document ?? null;
}

export async function getPostingOperationId(
  db: Queryable,
  documentId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ operationId: schema.documentOperations.operationId })
    .from(schema.documentOperations)
    .where(
      and(
        eq(schema.documentOperations.documentId, documentId),
        eq(schema.documentOperations.kind, "post"),
      ),
    )
    .limit(1);

  return row?.operationId ?? null;
}

export async function loadDocumentWithOperationId(
  db: Queryable,
  docType: string,
  documentId: string,
  storedOperationId?: string | null,
  registry?: DocumentRegistry,
) {
  const document = await getDocumentOrNull(db, documentId, docType);
  if (!document) {
    throw new DocumentNotFoundError(documentId);
  }

  return buildDocumentWithOperationId({
    registry,
    document,
    postingOperationId:
      storedOperationId ?? (await getPostingOperationId(db, document.id)),
  });
}

export function buildDefaultActionIdempotencyKey(
  action: string,
  payload: Record<string, unknown>,
) {
  return sha256Hex(canonicalJson({ action, ...payload }));
}

export function toStoredJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function readRecordStringField(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function readRecordIntField(
  record: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function buildDocumentEventState(document: Document) {
  return {
    id: document.id,
    docType: document.docType,
    docNo: document.docNo,
    moduleId: document.moduleId,
    moduleVersion: document.moduleVersion,
    payloadVersion: document.payloadVersion,
    title: document.title,
    occurredAt: document.occurredAt,
    submissionStatus: document.submissionStatus,
    approvalStatus: document.approvalStatus,
    postingStatus: document.postingStatus,
    lifecycleStatus: document.lifecycleStatus,
    amountMinor: document.amountMinor,
    currency: document.currency,
    memo: document.memo,
    version: document.version,
    postingError: document.postingError,
    postingStartedAt: document.postingStartedAt,
    postedAt: document.postedAt,
    updatedAt: document.updatedAt,
  };
}

export async function insertDocumentEvent(
  tx: Transaction,
  input: {
    documentId: string;
    eventType: string;
    actorId?: string | null;
    requestId?: string | null;
    correlationId?: string | null;
    traceId?: string | null;
    causationId?: string | null;
    reasonCode?: string | null;
    reasonMeta?: Record<string, unknown> | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
) {
  await tx.insert(schema.documentEvents).values({
    documentId: input.documentId,
    eventType: input.eventType,
    actorId: input.actorId ?? null,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    traceId: input.traceId ?? null,
    causationId: input.causationId ?? null,
    reasonCode: input.reasonCode ?? null,
    reasonMeta: input.reasonMeta ? toStoredJson(input.reasonMeta) : null,
    before: input.before ? toStoredJson(input.before) : null,
    after: input.after ? toStoredJson(input.after) : null,
  });

  const docType =
    readRecordStringField(input.after, "docType") ??
    readRecordStringField(input.before, "docType");
  const version =
    readRecordIntField(input.after, "version") ??
    readRecordIntField(input.before, "version");

  await pgNotify(
    tx,
    "document_changed",
    JSON.stringify({
      documentId: input.documentId,
      docType,
      version,
      eventType: input.eventType,
    }),
  );
}

export async function getLatestPostingArtifacts(
  tx: Queryable,
  documentId: string,
) {
  const [row] = await tx
    .select({ reasonMeta: schema.documentEvents.reasonMeta })
    .from(schema.documentEvents)
    .where(
      and(
        eq(schema.documentEvents.documentId, documentId),
        eq(schema.documentEvents.eventType, "post"),
      ),
    )
    .orderBy(desc(schema.documentEvents.createdAt))
    .limit(1);

  return (row?.reasonMeta as Record<string, unknown> | null) ?? null;
}

export function buildDocumentSearchCondition(query: string | undefined): SQL | undefined {
  if (!query) {
    return undefined;
  }

  const normalized = `%${normalizeSearchText(query)}%`;
  return or(
    like(sql`lower(${schema.documents.docNo})`, normalized),
    like(sql`lower(${schema.documents.id}::text)`, normalized),
    like(sql`lower(coalesce(${schema.documents.memo}, ''))`, normalized),
    like(sql`lower(${schema.documents.title})`, normalized),
    like(sql`lower(${schema.documents.searchText})`, normalized),
  )!;
}

export function inArraySafe<T>(column: any, values: T[] | undefined) {
  if (!values || values.length === 0) {
    return undefined;
  }

  return inArray(column, values as any[]);
}

export function resolveDocumentsSort(
  sortBy: "createdAt" | "occurredAt" | "updatedAt" | "postedAt",
  sortOrder: "asc" | "desc",
) {
  const column =
    sortBy === "createdAt"
      ? schema.documents.createdAt
      : sortBy === "updatedAt"
        ? schema.documents.updatedAt
        : sortBy === "postedAt"
          ? schema.documents.postedAt
          : schema.documents.occurredAt;

  return sortOrder === "asc" ? asc(column) : desc(column);
}

async function assertNoLinkCycle(
  tx: Transaction,
  fromDocumentId: string,
  toDocumentId: string,
  linkType: DocumentLinkType,
) {
  if (fromDocumentId === toDocumentId) {
    throw new DocumentGraphError(`Self-links are not allowed for ${linkType}`);
  }

  if (linkType !== "parent" && linkType !== "depends_on") {
    return;
  }

  const result = await tx.execute(sql`
    WITH RECURSIVE reach(id) AS (
      SELECT ${toDocumentId}::uuid
      UNION
      SELECT dl.to_document_id
      FROM ${schema.documentLinks} dl
      JOIN reach r ON dl.from_document_id = r.id
      WHERE dl.link_type = ${linkType}
    )
    SELECT 1
    FROM reach
    WHERE id = ${fromDocumentId}::uuid
    LIMIT 1
  `);

  if ((result.rows?.length ?? 0) > 0) {
    throw new DocumentGraphError(
      `Link ${linkType} would create a cycle between ${fromDocumentId} and ${toDocumentId}`,
    );
  }
}

export async function insertInitialLinks(
  tx: Transaction,
  document: Document,
  links: DocumentInitialLink[],
) {
  for (const link of links) {
    await assertNoLinkCycle(tx, document.id, link.toDocumentId, link.linkType);

    await tx
      .insert(schema.documentLinks)
      .values({
        fromDocumentId: document.id,
        toDocumentId: link.toDocumentId,
        linkType: link.linkType,
        role: link.role ?? null,
      })
      .onConflictDoNothing();
  }
}
