import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// --- ops_s3_cleanup_queue (was: s3_cleanup_queue) ---

export const opsS3CleanupQueue = pgTable("ops_s3_cleanup_queue", {
  id: serial("id").primaryKey(),
  s3Key: text("s3_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
