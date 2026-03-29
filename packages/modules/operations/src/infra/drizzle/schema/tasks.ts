import { relations, sql } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

import { user } from "@bedrock/iam/schema";

import { opsApplications } from "./applications";

// --- ops_todos (was: todos) ---

export const opsTodos = pgTable("ops_todos", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => user.id),
  applicationId: integer("application_id").references(
    () => opsApplications.id,
  ),
  title: text("title").notNull(),
  completed: boolean("completed").default(false).notNull(),
  order: integer("order").notNull().default(0),
  dueDate: text("due_date"),
  assignedBy: text("assigned_by").references(() => user.id),
  description: text("description"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const opsTodosRelations = relations(opsTodos, ({ one }) => ({
  agent: one(user, {
    fields: [opsTodos.agentId],
    references: [user.id],
    relationName: "todoAgent",
  }),
  assignedByUser: one(user, {
    fields: [opsTodos.assignedBy],
    references: [user.id],
    relationName: "todoAssigner",
  }),
  application: one(opsApplications, {
    fields: [opsTodos.applicationId],
    references: [opsApplications.id],
  }),
}));
