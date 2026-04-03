import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type OutboxStatus = "pending" | "processing" | "done" | "failed";

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id"),

    kind: text("kind").notNull(),
    refId: uuid("ref_id").notNull(),

    status: text("status").$type<OutboxStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),

    lockedAt: timestamp("locked_at", { withTimezone: true }),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("outbox_kind_ref_uq").on(t.kind, t.refId),
    index("outbox_claim_idx")
      .on(t.kind, t.status, t.availableAt, t.createdAt)
      .where(sql`${t.status} = 'pending'`),
    index("outbox_processing_lease_idx")
      .on(t.kind, t.status, t.lockedAt)
      .where(sql`${t.status} = 'processing'`),
    index("outbox_status_avail_idx").on(t.status, t.availableAt),
  ],
);
