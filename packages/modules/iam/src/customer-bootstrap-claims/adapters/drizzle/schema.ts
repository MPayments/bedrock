import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

import { customers } from "@bedrock/parties/schema";

import { user } from "../../../adapters/drizzle/schema/auth-schema";

export const customerBootstrapClaims = pgTable(
  "customer_bootstrap_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    normalizedInn: text("normalized_inn").notNull(),
    normalizedKpp: text("normalized_kpp").notNull().default(""),
    clientId: integer("client_id"),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("customer_bootstrap_claims_user_id_idx").on(table.userId),
    uniqueIndex("customer_bootstrap_claims_user_inn_kpp_idx").on(
      table.userId,
      table.normalizedInn,
      table.normalizedKpp,
    ),
  ],
);

export type CustomerBootstrapClaimRow =
  typeof customerBootstrapClaims.$inferSelect;
