import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "../../../adapters/drizzle/schema/auth-schema";

export const portalAccessGrants = pgTable(
  "portal_access_grants",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    id: uuid("id").primaryKey().defaultRandom(),
    status: text("status").notNull().default("pending_onboarding"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("portal_access_grants_status_idx").on(table.status),
    index("portal_access_grants_user_id_idx").on(table.userId),
    uniqueIndex("portal_access_grants_user_id_unique").on(table.userId),
  ],
);

export type PortalAccessGrantRow = typeof portalAccessGrants.$inferSelect;
