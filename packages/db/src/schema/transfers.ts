import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { currencies } from "./currencies";
import { ledgerOperations } from "./ledger/journal";
import { uint128 } from "./ledger/ledger";
import { operationalAccounts } from "./treasury/accounts";

export const transferKindEnum = pgEnum("transfer_kind", [
  "intra_org",
  "cross_org",
]);

export const transferSettlementModeEnum = pgEnum("transfer_settlement_mode", [
  "immediate",
  "pending",
]);

export const transferStatusEnum = pgEnum("transfer_status", [
  "draft",
  "approved_pending_posting",
  "pending",
  "settle_pending_posting",
  "void_pending_posting",
  "posted",
  "voided",
  "rejected",
  "failed",
]);

export const transferEventTypeEnum = pgEnum("transfer_event_type", [
  "approve",
  "settle",
  "void",
]);

export type TransferKind = (typeof transferKindEnum.enumValues)[number];
export type TransferSettlementMode =
  (typeof transferSettlementModeEnum.enumValues)[number];
export type TransferStatus = (typeof transferStatusEnum.enumValues)[number];
export type TransferEventType =
  (typeof transferEventTypeEnum.enumValues)[number];

export const transferOrders = pgTable(
  "transfer_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceCounterpartyId: uuid("source_counterparty_id").notNull(),
    destinationCounterpartyId: uuid("destination_counterparty_id").notNull(),
    sourceOperationalAccountId: uuid("source_operational_account_id")
      .notNull()
      .references(() => operationalAccounts.id),
    destinationOperationalAccountId: uuid("destination_operational_account_id")
      .notNull()
      .references(() => operationalAccounts.id),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    kind: transferKindEnum("kind").notNull(),
    settlementMode: transferSettlementModeEnum("settlement_mode")
      .notNull()
      .default("immediate"),
    timeoutSeconds: integer("timeout_seconds").notNull().default(0),
    status: transferStatusEnum("status").notNull().default("draft"),
    memo: text("memo"),
    makerUserId: uuid("maker_user_id").notNull(),
    checkerUserId: uuid("checker_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectReason: text("reject_reason"),
    ledgerOperationId: uuid("ledger_operation_id").references(
      () => ledgerOperations.id,
    ),
    sourcePendingTransferId: uint128("source_pending_transfer_id"),
    destinationPendingTransferId: uint128("destination_pending_transfer_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("transfer_orders_source_counterparty_idem_uq").on(
      t.sourceCounterpartyId,
      t.idempotencyKey,
    ),
    index("transfer_orders_status_idx").on(t.status),
    index("transfer_orders_source_counterparty_created_idx").on(
      t.sourceCounterpartyId,
      t.createdAt,
    ),
    index("transfer_orders_destination_counterparty_created_idx").on(
      t.destinationCounterpartyId,
      t.createdAt,
    ),
  ],
);

export const transferEvents = pgTable(
  "transfer_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => transferOrders.id, { onDelete: "cascade" }),
    eventType: transferEventTypeEnum("event_type").notNull(),
    eventIdempotencyKey: text("event_idempotency_key").notNull(),
    externalRef: text("external_ref"),
    ledgerOperationId: uuid("ledger_operation_id").references(
      () => ledgerOperations.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("transfer_events_transfer_type_idem_uq").on(
      t.transferId,
      t.eventType,
      t.eventIdempotencyKey,
    ),
    index("transfer_events_transfer_created_idx").on(t.transferId, t.createdAt),
  ],
);
