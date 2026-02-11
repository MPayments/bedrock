import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export type ReconciliationSeverity = "critical" | "high" | "medium" | "low";
export type ReconciliationStatus = "open" | "resolved";

export const reconciliationExceptions = pgTable(
    "reconciliation_exceptions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        source: text("source").notNull(),
        scopeKey: text("scope_key").notNull(),

        entityType: text("entity_type").notNull(),
        entityId: text("entity_id").notNull(),
        issueCode: text("issue_code").notNull(),

        severity: text("severity").$type<ReconciliationSeverity>().notNull().default("high"),
        status: text("status").$type<ReconciliationStatus>().notNull().default("open"),

        summary: text("summary").notNull(),
        details: text("details"),

        firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().default(sql`now()`),
        lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().default(sql`now()`),
        dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
        resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    },
    (t) => ([
        uniqueIndex("recon_exc_identity_uq").on(t.source, t.scopeKey, t.entityType, t.entityId, t.issueCode),
        index("recon_exc_status_due_idx").on(t.status, t.dueAt),
        index("recon_exc_scope_status_idx").on(t.scopeKey, t.status),
    ])
);
