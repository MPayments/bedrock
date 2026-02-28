import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { customers } from "./customers";
import { ledgerOperations } from "./ledger/journal";
import { operationalAccounts } from "./treasury/accounts";
import { counterparties } from "./treasury/counterparties";

export type DocumentSubmissionStatus = "draft" | "submitted";
export type DocumentApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";
export type DocumentPostingStatus =
  | "not_required"
  | "unposted"
  | "posting"
  | "posted"
  | "failed";
export type DocumentLifecycleStatus =
  | "active"
  | "cancelled"
  | "voided"
  | "archived";
export type DocumentLinkType =
  | "parent"
  | "depends_on"
  | "compensates"
  | "related";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    docType: text("doc_type").notNull(),
    docNo: text("doc_no").notNull(),
    payloadVersion: integer("payload_version").notNull().default(1),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    title: text("title").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    submissionStatus: text("submission_status")
      .$type<DocumentSubmissionStatus>()
      .notNull(),
    approvalStatus: text("approval_status")
      .$type<DocumentApprovalStatus>()
      .notNull(),
    postingStatus: text("posting_status").$type<DocumentPostingStatus>().notNull(),
    lifecycleStatus: text("lifecycle_status")
      .$type<DocumentLifecycleStatus>()
      .notNull(),
    createIdempotencyKey: text("create_idempotency_key"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currency: text("currency"),
    memo: text("memo"),
    counterpartyId: uuid("counterparty_id").references(() => counterparties.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    operationalAccountId: uuid("operational_account_id").references(
      () => operationalAccounts.id,
      { onDelete: "set null" },
    ),
    searchText: text("search_text")
      .notNull()
      .default(""),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    submittedBy: text("submitted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedBy: text("rejected_by").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by").references(() => user.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    postingStartedAt: timestamp("posting_started_at", { withTimezone: true }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postingError: text("posting_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("documents_doc_no_uq").on(t.docNo),
    uniqueIndex("documents_doc_type_create_idem_uq")
      .on(t.docType, t.createIdempotencyKey)
      .where(sql`${t.createIdempotencyKey} is not null`),
    index("documents_doc_type_occurred_idx").on(t.docType, t.occurredAt.desc()),
    index("documents_posting_status_occurred_idx").on(
      t.postingStatus,
      t.occurredAt.desc(),
    ),
    index("documents_approval_status_occurred_idx").on(
      t.approvalStatus,
      t.occurredAt.desc(),
    ),
    index("documents_lifecycle_status_occurred_idx").on(
      t.lifecycleStatus,
      t.occurredAt.desc(),
    ),
    index("documents_currency_idx").on(t.currency),
    index("documents_counterparty_idx").on(t.counterpartyId),
    index("documents_customer_idx").on(t.customerId),
    index("documents_operational_account_idx").on(t.operationalAccountId),
    index("documents_payload_gin_idx").using("gin", t.payload),
  ],
);

export const documentOperations = pgTable(
  "document_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => ledgerOperations.id),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("document_operations_document_kind_uq").on(t.documentId, t.kind),
    uniqueIndex("document_operations_operation_uq").on(t.operationId),
    index("document_operations_document_idx").on(t.documentId),
  ],
);

export const documentLinks = pgTable(
  "document_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromDocumentId: uuid("from_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    toDocumentId: uuid("to_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    linkType: text("link_type").$type<DocumentLinkType>().notNull(),
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("document_links_from_type_idx").on(t.fromDocumentId, t.linkType),
    index("document_links_to_type_idx").on(t.toDocumentId, t.linkType),
    uniqueIndex("document_links_unique_idx").on(
      t.fromDocumentId,
      t.toDocumentId,
      t.linkType,
      t.role,
    ),
  ],
);

export type Document = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;
export type DocumentOperation = typeof documentOperations.$inferSelect;
export type DocumentOperationInsert = typeof documentOperations.$inferInsert;
export type DocumentLink = typeof documentLinks.$inferSelect;
export type DocumentLinkInsert = typeof documentLinks.$inferInsert;
