import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { customers } from "@bedrock/parties/schema";

import { user } from "../../../adapters/drizzle/auth-schema";

export const customerMemberships = pgTable(
  "customer_memberships",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
      columns: [table.customerId, table.userId],
      name: "customer_memberships_pk",
    }),
    index("customer_memberships_user_id_idx").on(table.userId),
  ],
);

export const schema = {
  customerMemberships,
};

export type CustomerMembershipRow = typeof customerMemberships.$inferSelect;
