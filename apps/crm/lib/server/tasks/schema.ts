import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { deals } from "@bedrock/deals/schema";
import { user } from "@bedrock/iam/schema";

export const crmTasks = pgTable(
  "crm_tasks",
  {
    id: uuid("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date", { mode: "string" }),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    assigneeUserId: text("assignee_user_id")
      .notNull()
      .references(() => user.id),
    assignedByUserId: text("assigned_by_user_id")
      .notNull()
      .references(() => user.id),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("crm_tasks_assignee_sort_idx").on(table.assigneeUserId, table.sortOrder),
    index("crm_tasks_due_date_idx").on(table.dueDate),
    index("crm_tasks_completed_idx").on(table.completed),
    index("crm_tasks_deal_idx").on(table.dealId),
  ],
);

export const crmTasksRelations = relations(crmTasks, ({ one }) => ({
  assigneeUser: one(user, {
    fields: [crmTasks.assigneeUserId],
    references: [user.id],
    relationName: "crmTaskAssigneeUser",
  }),
  assignedByUser: one(user, {
    fields: [crmTasks.assignedByUserId],
    references: [user.id],
    relationName: "crmTaskAssignedByUser",
  }),
  deal: one(deals, {
    fields: [crmTasks.dealId],
    references: [deals.id],
  }),
}));

export const schema = {
  crmTasks,
  crmTasksRelations,
};
