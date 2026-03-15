import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { documents } from "@bedrock/documents/schema";
import { ledgerOperations } from "@bedrock/ledger/schema";

import type { ReconciliationExceptionState } from "../../../domain/exceptions";
import type { ReconciliationMatchStatus } from "../../../domain/matching";

export const reconciliationExternalRecords = pgTable(
  "reconciliation_external_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
    normalizedPayload: jsonb("normalized_payload")
      .$type<Record<string, unknown>>()
      .notNull(),
    payloadHash: text("payload_hash").notNull(),
    normalizationVersion: integer("normalization_version").notNull(),
    requestId: text("request_id"),
    correlationId: text("correlation_id"),
    traceId: text("trace_id"),
    causationId: text("causation_id"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("recon_external_records_source_id_uq").on(
      table.source,
      table.sourceRecordId,
    ),
    index("recon_external_records_source_received_idx").on(
      table.source,
      table.receivedAt,
    ),
  ],
);

export const reconciliationRuns = pgTable(
  "reconciliation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    rulesetChecksum: text("ruleset_checksum").notNull(),
    inputQuery: jsonb("input_query").$type<Record<string, unknown>>().notNull(),
    resultSummary: jsonb("result_summary")
      .$type<Record<string, unknown>>()
      .notNull(),
    requestId: text("request_id"),
    correlationId: text("correlation_id"),
    traceId: text("trace_id"),
    causationId: text("causation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index("recon_runs_source_created_idx").on(table.source, table.createdAt)],
);

export const reconciliationMatches = pgTable(
  "reconciliation_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => reconciliationRuns.id, { onDelete: "cascade" }),
    externalRecordId: uuid("external_record_id")
      .notNull()
      .references(() => reconciliationExternalRecords.id, {
        onDelete: "cascade",
      }),
    matchedOperationId: uuid("matched_operation_id").references(
      () => ledgerOperations.id,
      { onDelete: "set null" },
    ),
    matchedDocumentId: uuid("matched_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<ReconciliationMatchStatus>().notNull(),
    explanation: jsonb("explanation").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("recon_matches_run_idx").on(table.runId),
    index("recon_matches_external_record_idx").on(table.externalRecordId),
  ],
);

export const reconciliationExceptions = pgTable(
  "reconciliation_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => reconciliationRuns.id, { onDelete: "cascade" }),
    externalRecordId: uuid("external_record_id")
      .notNull()
      .references(() => reconciliationExternalRecords.id, {
        onDelete: "cascade",
      }),
    adjustmentDocumentId: uuid("adjustment_document_id").references(
      () => documents.id,
      {
        onDelete: "set null",
      },
    ),
    reasonCode: text("reason_code").notNull(),
    reasonMeta: jsonb("reason_meta").$type<Record<string, unknown> | null>(),
    state: text("state").$type<ReconciliationExceptionState>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("recon_exceptions_run_idx").on(table.runId),
    index("recon_exceptions_state_created_idx").on(table.state, table.createdAt),
  ],
);

export type ReconciliationExternalRecord =
  typeof reconciliationExternalRecords.$inferSelect;
export type ReconciliationExternalRecordInsert =
  typeof reconciliationExternalRecords.$inferInsert;
export type ReconciliationRun = typeof reconciliationRuns.$inferSelect;
export type ReconciliationRunInsert = typeof reconciliationRuns.$inferInsert;
export type ReconciliationMatch = typeof reconciliationMatches.$inferSelect;
export type ReconciliationMatchInsert = typeof reconciliationMatches.$inferInsert;
export type ReconciliationException =
  typeof reconciliationExceptions.$inferSelect;
export type ReconciliationExceptionInsert =
  typeof reconciliationExceptions.$inferInsert;

export const schema = {
  reconciliationExternalRecords,
  reconciliationRuns,
  reconciliationMatches,
  reconciliationExceptions,
};
