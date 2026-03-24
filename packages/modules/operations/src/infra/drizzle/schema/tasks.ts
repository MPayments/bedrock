import { relations, sql } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

import { opsAgents } from "./agents";
import { opsApplications } from "./applications";

// --- ops_todos (was: todos) ---

export const opsTodos = pgTable("ops_todos", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => opsAgents.id),
  applicationId: integer("application_id").references(
    () => opsApplications.id,
  ),
  title: text("title").notNull(),
  completed: boolean("completed").default(false).notNull(),
  order: integer("order").notNull().default(0),
  dueDate: text("due_date"),
  assignedBy: integer("assigned_by").references(() => opsAgents.id),
  description: text("description"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const opsTodosRelations = relations(opsTodos, ({ one }) => ({
  agent: one(opsAgents, {
    fields: [opsTodos.agentId],
    references: [opsAgents.id],
    relationName: "todoAgent",
  }),
  assignedByUser: one(opsAgents, {
    fields: [opsTodos.assignedBy],
    references: [opsAgents.id],
    relationName: "todoAssigner",
  }),
  application: one(opsApplications, {
    fields: [opsTodos.applicationId],
    references: [opsApplications.id],
  }),
}));
