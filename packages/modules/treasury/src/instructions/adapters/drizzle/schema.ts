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

import type { TreasuryInstructionState } from "../../domain/instruction-types";
import { treasuryOperations } from "../../../operations/adapters/drizzle/schema";

export const treasuryInstructions = pgTable(
  "treasury_instructions",
  {
    id: uuid("id").primaryKey(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => treasuryOperations.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    state: text("state").$type<TreasuryInstructionState>().notNull(),
    sourceRef: text("source_ref").notNull(),
    providerRef: text("provider_ref"),
    providerSnapshot: jsonb("provider_snapshot")
      .$type<Record<string, unknown> | null>()
      .default(null),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    returnRequestedAt: timestamp("return_requested_at", {
      withTimezone: true,
    }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_instructions_source_ref_uq").on(table.sourceRef),
    uniqueIndex("treasury_instructions_operation_attempt_uq").on(
      table.operationId,
      table.attempt,
    ),
    index("treasury_instructions_operation_idx").on(table.operationId),
    index("treasury_instructions_state_idx").on(table.state),
  ],
);
