import "server-only";

import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { deals } from "@bedrock/deals/schema";
import { user } from "@bedrock/iam/schema";

import type { CrmApiSession } from "@/lib/server/auth";
import { crmTasksDb } from "@/lib/server/tasks/db";
import { crmTasks } from "@/lib/server/tasks/schema";
import {
  type CalendarCrmTasksQuery,
  type CreateCrmTaskInput,
  type CrmTask,
  type ListCrmTasksQuery,
  type UpdateCrmTaskInput,
} from "@/lib/tasks/contracts";

const assigneeUser = alias(user, "crm_task_assignee_user");
const assignedByUser = alias(user, "crm_task_assigned_by_user");

const persistedTaskRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  dueDate: z.string().nullable(),
  completed: z.boolean(),
  sortOrder: z.number().int(),
  assigneeUserId: z.string(),
  assignedByUserId: z.string(),
  dealId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  assigneeUserIdValue: z.string().nullable(),
  assigneeUserName: z.string().nullable(),
  assignedByUserIdValue: z.string().nullable(),
  assignedByUserName: z.string().nullable(),
});

function toTask(row: unknown): CrmTask {
  const parsed = persistedTaskRowSchema.parse(row);

  return {
    id: parsed.id,
    title: parsed.title,
    description: parsed.description,
    dueDate: parsed.dueDate,
    completed: parsed.completed,
    sortOrder: parsed.sortOrder,
    assigneeUserId: parsed.assigneeUserId,
    assignedByUserId: parsed.assignedByUserId,
    dealId: parsed.dealId,
    createdAt: parsed.createdAt.toISOString(),
    updatedAt: parsed.updatedAt.toISOString(),
    assigneeUser: parsed.assigneeUserIdValue && parsed.assigneeUserName
      ? {
          id: parsed.assigneeUserIdValue,
          name: parsed.assigneeUserName,
        }
      : null,
    assignedByUser: parsed.assignedByUserIdValue && parsed.assignedByUserName
      ? {
          id: parsed.assignedByUserIdValue,
          name: parsed.assignedByUserName,
        }
      : null,
  };
}

function resolveAssigneeUserId(
  session: CrmApiSession,
  requestedAssigneeUserId?: string,
): string {
  if (!session.isAdmin) {
    return session.currentUserId;
  }

  return requestedAssigneeUserId ?? session.currentUserId;
}

async function ensureUserExists(userId: string): Promise<void> {
  const [row] = await crmTasksDb
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row) {
    throw new Error(`Unknown user: ${userId}`);
  }
}

async function ensureDealExists(dealId: string): Promise<void> {
  const [row] = await crmTasksDb
    .select({ id: deals.id })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);

  if (!row) {
    throw new Error(`Unknown deal: ${dealId}`);
  }
}

async function getMaxSortOrderForAssignee(assigneeUserId: string): Promise<number> {
  const [row] = await crmTasksDb
    .select({
      maxSortOrder: sql<number>`coalesce(max(${crmTasks.sortOrder}), -1)::int`,
    })
    .from(crmTasks)
    .where(eq(crmTasks.assigneeUserId, assigneeUserId));

  return row?.maxSortOrder ?? -1;
}

function buildTaskSelect() {
  return {
    id: crmTasks.id,
    title: crmTasks.title,
    description: crmTasks.description,
    dueDate: crmTasks.dueDate,
    completed: crmTasks.completed,
    sortOrder: crmTasks.sortOrder,
    assigneeUserId: crmTasks.assigneeUserId,
    assignedByUserId: crmTasks.assignedByUserId,
    dealId: crmTasks.dealId,
    createdAt: crmTasks.createdAt,
    updatedAt: crmTasks.updatedAt,
    assigneeUserIdValue: assigneeUser.id,
    assigneeUserName: assigneeUser.name,
    assignedByUserIdValue: assignedByUser.id,
    assignedByUserName: assignedByUser.name,
  } as const;
}

async function getTaskRecordById(id: string) {
  const [row] = await crmTasksDb
    .select(buildTaskSelect())
    .from(crmTasks)
    .leftJoin(assigneeUser, eq(assigneeUser.id, crmTasks.assigneeUserId))
    .leftJoin(assignedByUser, eq(assignedByUser.id, crmTasks.assignedByUserId))
    .where(eq(crmTasks.id, id))
    .limit(1);

  return row ? toTask(row) : null;
}

async function getRawTaskById(id: string) {
  const [row] = await crmTasksDb
    .select()
    .from(crmTasks)
    .where(eq(crmTasks.id, id))
    .limit(1);

  return row ?? null;
}

function assertMutationAccess(session: CrmApiSession, assigneeUserId: string) {
  if (!session.isAdmin && assigneeUserId !== session.currentUserId) {
    throw new Error("Forbidden");
  }
}

export async function listCrmTasks(
  session: CrmApiSession,
  query: ListCrmTasksQuery,
): Promise<CrmTask[]> {
  const assigneeUserId = resolveAssigneeUserId(session, query.assigneeUserId);
  const conditions = [eq(crmTasks.assigneeUserId, assigneeUserId)];

  if (query.completed !== undefined) {
    conditions.push(eq(crmTasks.completed, query.completed));
  }

  if (query.dealId) {
    conditions.push(eq(crmTasks.dealId, query.dealId));
  }

  if (query.dateTo) {
    const baseDateCondition = lte(crmTasks.dueDate, query.dateTo);
    conditions.push(
      query.includeNoDueDate
        ? (or(baseDateCondition, isNull(crmTasks.dueDate)) ?? baseDateCondition)
        : baseDateCondition,
    );
  }

  const rows = await crmTasksDb
    .select(buildTaskSelect())
    .from(crmTasks)
    .leftJoin(assigneeUser, eq(assigneeUser.id, crmTasks.assigneeUserId))
    .leftJoin(assignedByUser, eq(assignedByUser.id, crmTasks.assignedByUserId))
    .where(and(...conditions))
    .orderBy(
      asc(crmTasks.sortOrder),
      asc(crmTasks.createdAt),
      asc(crmTasks.id),
    );

  return rows.map(toTask);
}

export async function createCrmTask(
  session: CrmApiSession,
  input: CreateCrmTaskInput,
): Promise<CrmTask> {
  const assigneeUserId = resolveAssigneeUserId(session, input.assigneeUserId);
  const taskId = randomUUID();

  assertMutationAccess(session, assigneeUserId);
  await ensureUserExists(assigneeUserId);

  if (input.dealId) {
    await ensureDealExists(input.dealId);
  }

  const sortOrder = (await getMaxSortOrderForAssignee(assigneeUserId)) + 1;

  await crmTasksDb.insert(crmTasks).values({
    id: taskId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    dueDate: input.dueDate ?? null,
    completed: false,
    sortOrder,
    assigneeUserId,
    assignedByUserId: session.currentUserId,
    dealId: input.dealId ?? null,
  });

  const task = await getTaskRecordById(taskId);

  if (!task) {
    throw new Error("Failed to load created CRM task");
  }

  return task;
}

export async function updateCrmTask(
  session: CrmApiSession,
  id: string,
  input: UpdateCrmTaskInput,
): Promise<CrmTask> {
  const existingTask = await getRawTaskById(id);

  if (!existingTask) {
    throw new Error("Not found");
  }

  assertMutationAccess(session, existingTask.assigneeUserId);

  const nextAssigneeUserId =
    input.assigneeUserId !== undefined
      ? resolveAssigneeUserId(session, input.assigneeUserId)
      : existingTask.assigneeUserId;

  assertMutationAccess(session, nextAssigneeUserId);

  if (input.assigneeUserId !== undefined) {
    await ensureUserExists(nextAssigneeUserId);
  }

  if (input.dealId) {
    await ensureDealExists(input.dealId);
  }

  const values: Partial<typeof crmTasks.$inferInsert> = {};

  if (input.title !== undefined) {
    values.title = input.title.trim();
  }

  if (input.description !== undefined) {
    values.description = input.description?.trim() || null;
  }

  if (input.dueDate !== undefined) {
    values.dueDate = input.dueDate ?? null;
  }

  if (input.completed !== undefined) {
    values.completed = input.completed;
  }

  if (input.dealId !== undefined) {
    values.dealId = input.dealId ?? null;
  }

  if (
    input.assigneeUserId !== undefined &&
    nextAssigneeUserId !== existingTask.assigneeUserId
  ) {
    values.assigneeUserId = nextAssigneeUserId;
    values.sortOrder = (await getMaxSortOrderForAssignee(nextAssigneeUserId)) + 1;
  }

  await crmTasksDb
    .update(crmTasks)
    .set(values)
    .where(eq(crmTasks.id, id));

  const updatedTask = await getTaskRecordById(id);

  if (!updatedTask) {
    throw new Error("Failed to load updated CRM task");
  }

  return updatedTask;
}

export async function deleteCrmTask(
  session: CrmApiSession,
  id: string,
): Promise<void> {
  const existingTask = await getRawTaskById(id);

  if (!existingTask) {
    throw new Error("Not found");
  }

  assertMutationAccess(session, existingTask.assigneeUserId);

  await crmTasksDb.delete(crmTasks).where(eq(crmTasks.id, id));
}

export async function reorderCrmTasks(
  session: CrmApiSession,
  orderedTaskIds: string[],
): Promise<void> {
  await crmTasksDb.transaction(async (tx) => {
    const selectedTasks = await tx
      .select()
      .from(crmTasks)
      .where(inArray(crmTasks.id, orderedTaskIds))
      .orderBy(asc(crmTasks.sortOrder), asc(crmTasks.createdAt), asc(crmTasks.id));

    if (selectedTasks.length !== orderedTaskIds.length) {
      throw new Error("Some tasks were not found");
    }

    const assigneeSet = new Set(selectedTasks.map((task) => task.assigneeUserId));

    if (assigneeSet.size !== 1) {
      throw new Error("Tasks must share the same assignee");
    }

    const [assigneeUserId] = Array.from(assigneeSet);
    assertMutationAccess(session, assigneeUserId!);

    const selectedTaskMap = new Map(selectedTasks.map((task) => [task.id, task]));
    const orderedSelectedTasks = orderedTaskIds.map((id) => {
      const task = selectedTaskMap.get(id);
      if (!task) {
        throw new Error(`Task ${id} is missing`);
      }
      return task;
    });

    const remainingTasks = await tx
      .select()
      .from(crmTasks)
      .where(
        and(
          eq(crmTasks.assigneeUserId, assigneeUserId!),
          notInArray(crmTasks.id, orderedTaskIds),
        ),
      )
      .orderBy(asc(crmTasks.sortOrder), asc(crmTasks.createdAt), asc(crmTasks.id));

    const nextOrdering = [...orderedSelectedTasks, ...remainingTasks];

    for (const [index, task] of nextOrdering.entries()) {
      await tx
        .update(crmTasks)
        .set({ sortOrder: index })
        .where(eq(crmTasks.id, task.id));
    }
  });
}

export async function getCrmTaskCalendar(
  session: CrmApiSession,
  query: CalendarCrmTasksQuery,
): Promise<{
  month: string;
  tasks: Record<string, CrmTask[]>;
  totalCount: number;
}> {
  const tasks = await listCrmTasks(session, {
    assigneeUserId: query.assigneeUserId,
  });

  const grouped: Record<string, CrmTask[]> = { noDueDate: [] };

  for (const task of tasks) {
    if (task.dueDate?.startsWith(query.month)) {
      grouped[task.dueDate] ??= [];
      grouped[task.dueDate]!.push(task);
      continue;
    }

    if (!task.dueDate) {
      grouped.noDueDate!.push(task);
    }
  }

  return {
    month: query.month,
    tasks: grouped,
    totalCount: tasks.length,
  };
}
