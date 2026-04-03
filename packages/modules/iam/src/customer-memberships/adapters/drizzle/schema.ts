import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { customers } from "@bedrock/parties/schema";

import { user } from "../../../adapters/drizzle/schema/auth-schema";

export const customerMemberships = pgTable(
  "customer_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("customer_memberships_user_id_idx").on(table.userId),
    uniqueIndex("customer_memberships_customer_user_idx").on(
      table.customerId,
      table.userId,
    ),
  ],
);

export const schema = {
  customerMemberships,
};

export type CustomerMembershipRow = typeof customerMemberships.$inferSelect;
