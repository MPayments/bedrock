import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type ActionReceiptStatus = "ok" | "conflict" | "error";

export const actionReceipts = pgTable(
  "action_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    actorId: text("actor_id"),
    requestHash: text("request_hash").notNull(),
    status: text("status").$type<ActionReceiptStatus>().notNull(),
    resultJson: jsonb("result_json").$type<Record<string, unknown> | null>(),
    errorJson: jsonb("error_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("action_receipts_scope_key_uq").on(t.scope, t.idempotencyKey),
    index("action_receipts_scope_created_idx").on(t.scope, t.createdAt),
  ],
);

export type ActionReceipt = typeof actionReceipts.$inferSelect;
export type ActionReceiptInsert = typeof actionReceipts.$inferInsert;

export const schema = {
  actionReceipts,
};
