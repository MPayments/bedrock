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

import { currencies } from "@bedrock/currencies/schema";

import type {
  PaymentStepAttemptOutcome,
  PaymentStepDealLegRole,
  PaymentStepKind,
  PaymentStepPurpose,
  PaymentStepRateLockedSide,
  PaymentStepState,
  PostingDocumentRef,
} from "../../../domain/types";

export const paymentSteps = pgTable(
  "payment_steps",
  {
    id: uuid("id").primaryKey(),
    purpose: text("purpose").$type<PaymentStepPurpose>().notNull(),
    kind: text("kind").$type<PaymentStepKind>().notNull(),
    state: text("state").$type<PaymentStepState>().notNull().default("draft"),
    dealId: uuid("deal_id"),
    dealLegIdx: integer("deal_leg_idx"),
    dealLegRole: text("deal_leg_role").$type<PaymentStepDealLegRole | null>(),
    treasuryBatchId: uuid("treasury_batch_id"),
    fromPartyId: uuid("from_party_id").notNull(),
    fromRequisiteId: uuid("from_requisite_id"),
    toPartyId: uuid("to_party_id").notNull(),
    toRequisiteId: uuid("to_requisite_id"),
    fromCurrencyId: uuid("from_currency_id")
      .notNull()
      .references(() => currencies.id),
    toCurrencyId: uuid("to_currency_id")
      .notNull()
      .references(() => currencies.id),
    fromAmountMinor: bigint("from_amount_minor", { mode: "bigint" }),
    toAmountMinor: bigint("to_amount_minor", { mode: "bigint" }),
    rateValue: text("rate_value"),
    rateLockedSide:
      text("rate_locked_side").$type<PaymentStepRateLockedSide | null>(),
    postings: jsonb("postings")
      .$type<PostingDocumentRef[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("payment_steps_deal_leg_uq").on(
      table.dealId,
      table.dealLegIdx,
    ),
    index("payment_steps_purpose_idx").on(table.purpose),
    index("payment_steps_kind_idx").on(table.kind),
    index("payment_steps_state_idx").on(table.state),
    index("payment_steps_deal_idx").on(table.dealId),
    index("payment_steps_batch_idx").on(table.treasuryBatchId),
    index("payment_steps_scheduled_idx").on(table.scheduledAt),
  ],
);

export const paymentStepAttempts = pgTable(
  "payment_step_attempts",
  {
    id: uuid("id").primaryKey(),
    paymentStepId: uuid("payment_step_id")
      .notNull()
      .references(() => paymentSteps.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull(),
    providerRef: text("provider_ref"),
    providerSnapshot: jsonb("provider_snapshot").$type<unknown>(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    outcome: text("outcome")
      .$type<PaymentStepAttemptOutcome>()
      .notNull()
      .default("pending"),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("payment_step_attempts_step_attempt_uq").on(
      table.paymentStepId,
      table.attemptNo,
    ),
    index("payment_step_attempts_step_idx").on(table.paymentStepId),
    index("payment_step_attempts_outcome_idx").on(table.outcome),
    index("payment_step_attempts_provider_ref_idx").on(table.providerRef),
  ],
);
