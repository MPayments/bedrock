import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ledgerOperations } from "./journal";
import { uint128 } from "./ledger";

export type TbPlanStatus = "pending" | "posted" | "failed";
export type TbPlanType = "create" | "post_pending" | "void_pending";

export const tbTransferPlans = pgTable(
  "tb_transfer_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    operationId: uuid("operation_id")
      .notNull()
      .references(() => ledgerOperations.id, { onDelete: "restrict" }),

    lineNo: integer("line_no").notNull(),
    type: text("type").$type<TbPlanType>().notNull().default("create"),

    transferId: uint128("transfer_id").notNull(),

    debitTbAccountId: uint128("debit_tb_account_id"),
    creditTbAccountId: uint128("credit_tb_account_id"),

    tbLedger: bigint("tb_ledger", { mode: "number" }).notNull().default(0),
    amount: bigint("amount", { mode: "bigint" }).notNull().default(sql`0`),
    code: integer("code").notNull().default(1),

    pendingRef: text("pending_ref"),
    pendingId: uint128("pending_id"),

    isLinked: boolean("is_linked").notNull().default(false),
    isPending: boolean("is_pending").notNull().default(false),
    timeoutSeconds: integer("timeout_seconds").notNull().default(0),

    status: text("status").$type<TbPlanStatus>().notNull().default("pending"),
    error: text("error"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("tb_plan_operation_line_uq").on(t.operationId, t.lineNo),
    uniqueIndex("tb_plan_transfer_uq").on(t.transferId),
    index("tb_plan_post_idx").on(t.operationId, t.lineNo),
    index("tb_plan_status_idx").on(t.status),

    check("tb_plan_amount_nonneg", sql`${t.amount} >= 0`),
    check(
      "tb_plan_create_accounts",
      sql`(${t.type} <> 'create') OR (${t.debitTbAccountId} IS NOT NULL AND ${t.creditTbAccountId} IS NOT NULL)`,
    ),
    check(
      "tb_plan_pending_id",
      sql`(${t.type} = 'create') OR (${t.pendingId} IS NOT NULL)`,
    ),
    check(
      "tb_plan_void_amount",
      sql`(${t.type} <> 'void_pending') OR (${t.amount} = 0)`,
    ),
    check(
      "tb_plan_timeout",
      sql`(${t.isPending} = false) OR (${t.timeoutSeconds} > 0)`,
    ),
  ],
);
