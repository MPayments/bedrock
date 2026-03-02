import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { documents } from "../documents/schema";

export type ConnectorDirection = "payin" | "payout";
export type ConnectorIntentStatus =
  | "planned"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "cancelled";
export type PaymentAttemptStatus =
  | "queued"
  | "dispatching"
  | "submitted"
  | "pending"
  | "succeeded"
  | "failed_retryable"
  | "failed_terminal"
  | "cancelled";
export type ConnectorEventParseStatus = "accepted" | "rejected";
export type ConnectorHealthStatus = "up" | "degraded" | "down";

export const connectorPaymentIntents = pgTable(
  "connector_payment_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    docType: text("doc_type").notNull(),
    direction: text("direction").$type<ConnectorDirection>().notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    corridor: text("corridor"),
    providerConstraint: text("provider_constraint"),
    status: text("status").$type<ConnectorIntentStatus>().notNull(),
    currentAttemptNo: integer("current_attempt_no").notNull().default(0),
    lastError: text("last_error"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("connector_payment_intents_document_uq").on(t.documentId),
    index("connector_payment_intents_status_idx").on(t.status, t.updatedAt),
  ],
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    intentId: uuid("intent_id")
      .notNull()
      .references(() => connectorPaymentIntents.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull(),
    providerCode: text("provider_code").notNull(),
    providerRoute: text("provider_route"),
    status: text("status").$type<PaymentAttemptStatus>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    externalAttemptRef: text("external_attempt_ref"),
    requestPayload: jsonb("request_payload").$type<Record<
      string,
      unknown
    > | null>(),
    responsePayload: jsonb("response_payload").$type<Record<
      string,
      unknown
    > | null>(),
    error: text("error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    claimToken: text("claim_token"),
    claimUntil: timestamp("claim_until", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("payment_attempts_intent_no_uq").on(t.intentId, t.attemptNo),
    uniqueIndex("payment_attempts_idempotency_uq").on(t.idempotencyKey),
    index("payment_attempts_dispatch_claim_idx")
      .on(t.status, t.nextRetryAt, t.createdAt)
      .where(sql`${t.status} in ('queued','failed_retryable')`),
    index("payment_attempts_poll_claim_idx")
      .on(t.status, t.updatedAt)
      .where(sql`${t.status} in ('submitted','pending')`),
    index("payment_attempts_poll_claim_lease_idx")
      .on(t.status, t.claimUntil, t.updatedAt)
      .where(sql`${t.status} in ('submitted','pending')`),
    index("payment_attempts_provider_status_idx").on(t.providerCode, t.status),
  ],
);

export const connectorEvents = pgTable(
  "connector_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerCode: text("provider_code").notNull(),
    eventType: text("event_type").notNull(),
    webhookIdempotencyKey: text("webhook_idempotency_key").notNull(),
    signatureValid: boolean("signature_valid").notNull().default(false),
    parseStatus: text("parse_status")
      .$type<ConnectorEventParseStatus>()
      .notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
    parsedPayload: jsonb("parsed_payload").$type<Record<
      string,
      unknown
    > | null>(),
    intentId: uuid("intent_id").references(() => connectorPaymentIntents.id, {
      onDelete: "set null",
    }),
    attemptId: uuid("attempt_id").references(() => paymentAttempts.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("connector_events_provider_key_uq").on(
      t.providerCode,
      t.webhookIdempotencyKey,
    ),
    index("connector_events_provider_received_idx").on(
      t.providerCode,
      t.receivedAt,
    ),
    index("connector_events_intent_received_idx").on(t.intentId, t.receivedAt),
  ],
);

export const connectorReferences = pgTable(
  "connector_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerCode: text("provider_code").notNull(),
    intentId: uuid("intent_id").references(() => connectorPaymentIntents.id, {
      onDelete: "cascade",
    }),
    attemptId: uuid("attempt_id").references(() => paymentAttempts.id, {
      onDelete: "cascade",
    }),
    refKind: text("ref_kind").notNull(),
    refValue: text("ref_value").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("connector_references_provider_kind_value_uq").on(
      t.providerCode,
      t.refKind,
      t.refValue,
    ),
    index("connector_references_intent_idx").on(t.intentId, t.createdAt),
    index("connector_references_attempt_idx").on(t.attemptId, t.createdAt),
  ],
);

export const connectorHealth = pgTable("connector_health", {
  providerCode: text("provider_code").primaryKey(),
  status: text("status").$type<ConnectorHealthStatus>().notNull(),
  score: integer("score").notNull().default(100),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdateFn(() => new Date()),
});

export const connectorCursors = pgTable(
  "connector_cursors",
  {
    providerCode: text("provider_code").notNull(),
    cursorKey: text("cursor_key").notNull(),
    cursorValue: text("cursor_value"),
    claimToken: text("claim_token"),
    claimUntil: timestamp("claim_until", { withTimezone: true }),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    primaryKey({
      name: "connector_cursors_pk",
      columns: [t.providerCode, t.cursorKey],
    }),
    index("connector_cursors_claim_idx").on(t.claimUntil, t.updatedAt),
  ],
);

export type ConnectorPaymentIntent =
  typeof connectorPaymentIntents.$inferSelect;
export type ConnectorPaymentIntentInsert =
  typeof connectorPaymentIntents.$inferInsert;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type PaymentAttemptInsert = typeof paymentAttempts.$inferInsert;
export type ConnectorEvent = typeof connectorEvents.$inferSelect;
export type ConnectorEventInsert = typeof connectorEvents.$inferInsert;
export type ConnectorReference = typeof connectorReferences.$inferSelect;
export type ConnectorReferenceInsert = typeof connectorReferences.$inferInsert;
export type ConnectorHealth = typeof connectorHealth.$inferSelect;
export type ConnectorHealthInsert = typeof connectorHealth.$inferInsert;
export type ConnectorCursor = typeof connectorCursors.$inferSelect;
export type ConnectorCursorInsert = typeof connectorCursors.$inferInsert;

export const schema = {
  connectorPaymentIntents,
  paymentAttempts,
  connectorEvents,
  connectorReferences,
  connectorHealth,
  connectorCursors,
};
