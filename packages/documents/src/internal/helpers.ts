import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/db";
import { schema, type Document, type DocumentLinkType } from "@bedrock/db/schema";

import { DocumentGraphError, DocumentNotFoundError, DocumentRegistryError } from "../errors";
import type {
  DocumentInitialLink,
  DocumentModule,
  DocumentModuleContext,
  DocumentRegistry,
  DocumentSummaryFields,
} from "../types";

type Queryable = Database | Transaction;

export function buildDocNo(prefix: string, documentId: string) {
  return `${prefix}-${documentId.slice(0, 8).toUpperCase()}`;
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
    operationalAccountId: summary.operationalAccountId ?? null,
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

export function createModuleContext(
  deps: Pick<DocumentModuleContext, "actorUserId" | "db" | "log" | "now">,
): DocumentModuleContext {
  return deps;
}

export function createDocumentInsertBase(params: {
  id?: string;
  docType: string;
  docNoPrefix: string;
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
    operationalAccountId: null,
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
