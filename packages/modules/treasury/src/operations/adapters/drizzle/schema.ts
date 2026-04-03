import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { currencies } from "@bedrock/currencies/schema";

import { fxQuotes } from "../../../quotes/adapters/drizzle/schema";
import type {
  TreasuryOperationKind,
  TreasuryOperationState,
} from "../../domain/operation-types";

export const treasuryOperations = pgTable(
  "treasury_operations",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id"),
    customerId: uuid("customer_id"),
    internalEntityOrganizationId: uuid("internal_entity_organization_id"),
    kind: text("kind").$type<TreasuryOperationKind>().notNull(),
    state: text("state")
      .$type<TreasuryOperationState>()
      .notNull()
      .default("planned"),
    sourceRef: text("source_ref").notNull(),
    quoteId: uuid("quote_id").references(() => fxQuotes.id),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyId: uuid("currency_id").references(() => currencies.id),
    counterAmountMinor: bigint("counter_amount_minor", { mode: "bigint" }),
    counterCurrencyId: uuid("counter_currency_id").references(() => currencies.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_operations_source_ref_uq").on(table.sourceRef),
    index("treasury_operations_deal_idx").on(table.dealId),
    index("treasury_operations_customer_idx").on(table.customerId),
    index("treasury_operations_internal_entity_idx").on(
      table.internalEntityOrganizationId,
    ),
    index("treasury_operations_kind_idx").on(table.kind),
    index("treasury_operations_quote_idx").on(table.quoteId),
  ],
);
