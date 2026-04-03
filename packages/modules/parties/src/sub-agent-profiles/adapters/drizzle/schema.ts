import { sql } from "drizzle-orm";
import {
  boolean,
  numeric,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { counterparties } from "../../../counterparties/adapters/drizzle/schema";

export const subAgentProfiles = pgTable("sub_agent_profiles", {
  counterpartyId: uuid("counterparty_id")
    .primaryKey()
    .references(() => counterparties.id, { onDelete: "cascade" }),
  commissionRate: numeric("commission_rate", { mode: "number" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdateFn(() => new Date()),
});

export type SubAgentProfileRow = typeof subAgentProfiles.$inferSelect;
