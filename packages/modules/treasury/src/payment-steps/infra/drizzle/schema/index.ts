import { sql } from "drizzle-orm";
import {
  bigint,
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

import { currencies } from "@bedrock/currencies/schema";

import type {
  PaymentStepAttemptOutcome,
  PaymentStepKind,
  PaymentStepAmendmentRecord,
  PaymentStepOrigin,
  PaymentStepPurpose,
  PaymentStepRateLockedSide,
  PaymentStepReturnRecord,
  PaymentStepRouteSnapshot,
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
    sourceRef: text("source_ref").notNull(),
    origin: jsonb("origin").$type<PaymentStepOrigin>().notNull(),
    dealId: uuid("deal_id"),
    treasuryBatchId: uuid("treasury_batch_id"),
    treasuryOrderId: uuid("treasury_order_id"),
    quoteId: uuid("quote_id"),
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
    plannedRoute: jsonb("planned_route").$type<PaymentStepRouteSnapshot>().notNull(),
    currentRoute: jsonb("current_route").$type<PaymentStepRouteSnapshot>().notNull(),
    amendments: jsonb("amendments")
      .$type<PaymentStepAmendmentRecord[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    postingDocumentRefs: jsonb("postings")
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
    uniqueIndex("payment_steps_source_ref_uq").on(table.sourceRef),
    index("payment_steps_purpose_idx").on(table.purpose),
    index("payment_steps_kind_idx").on(table.kind),
    index("payment_steps_state_idx").on(table.state),
    index("payment_steps_deal_idx").on(table.dealId),
    index("payment_steps_batch_idx").on(table.treasuryBatchId),
    index("payment_steps_order_idx").on(table.treasuryOrderId),
    index("payment_steps_scheduled_idx").on(table.scheduledAt),
  ],
);

export const paymentStepReturns = pgTable(
  "payment_step_returns",
  {
    id: uuid("id").primaryKey(),
    paymentStepId: uuid("payment_step_id")
      .notNull()
      .references(() => paymentSteps.id, { onDelete: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyId: uuid("currency_id").references(() => currencies.id),
    providerRef: text("provider_ref"),
    reason: text("reason"),
    returnedAt: timestamp("returned_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("payment_step_returns_step_idx").on(table.paymentStepId),
    index("payment_step_returns_returned_at_idx").on(table.returnedAt),
  ],
);

export const paymentStepArtifacts = pgTable(
  "payment_step_artifacts",
  {
    paymentStepId: uuid("payment_step_id")
      .notNull()
      .references(() => paymentSteps.id, { onDelete: "cascade" }),
    fileAssetId: uuid("file_asset_id").notNull(),
    purpose: text("purpose").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [table.paymentStepId, table.fileAssetId, table.purpose],
      name: "payment_step_artifacts_pk",
    }),
    index("payment_step_artifacts_step_idx").on(table.paymentStepId),
    index("payment_step_artifacts_step_purpose_idx").on(
      table.paymentStepId,
      table.purpose,
    ),
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
