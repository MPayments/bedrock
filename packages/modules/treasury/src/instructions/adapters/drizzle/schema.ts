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

import { treasuryOperations } from "../../../operations/adapters/drizzle/schema";
import type { TreasuryInstructionArtifactPurpose } from "../../domain/instruction-types";
import type { TreasuryInstructionState } from "../../domain/instruction-types";

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

export const treasuryInstructionArtifacts = pgTable(
  "treasury_instruction_artifacts",
  {
    id: uuid("id").primaryKey(),
    instructionId: uuid("instruction_id")
      .notNull()
      .references(() => treasuryInstructions.id, { onDelete: "cascade" }),
    fileAssetId: uuid("file_asset_id").notNull(),
    purpose: text("purpose")
      .$type<TreasuryInstructionArtifactPurpose>()
      .notNull(),
    memo: text("memo"),
    uploadedByUserId: text("uploaded_by_user_id").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("treasury_instruction_artifacts_instruction_uploaded_idx").on(
      table.instructionId,
      table.uploadedAt.desc(),
    ),
    index("treasury_instruction_artifacts_instruction_purpose_idx").on(
      table.instructionId,
      table.purpose,
    ),
  ],
);
