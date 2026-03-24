import { pgTable, text, varchar } from "drizzle-orm/pg-core";

// --- ops_telegraf_sessions (was: telegraf_sessions) ---

export const opsTelegrafSessions = pgTable("ops_telegraf_sessions", {
  key: varchar("key", { length: 32 }).primaryKey(),
  session: text("session").notNull(),
});
