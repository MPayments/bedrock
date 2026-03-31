import {
  CalendarCrmTasksResponseSchema,
  type CalendarCrmTasksQuery,
  CrmTaskCapabilitiesSchema,
  CrmTaskSchema,
  ListCrmTasksResponseSchema,
  type CreateCrmTaskInput,
  type CrmTask,
  type CrmTaskCapabilities,
  type ListCrmTasksQuery,
  type ReorderCrmTasksInput,
  type UpdateCrmTaskInput,
} from "@/lib/tasks/contracts";
import { CRM_API_BASE_URL } from "@/lib/constants";

async function crmApiFetch<T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T,
): Promise<T> {
  const response = await fetch(`${CRM_API_BASE_URL}${path}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw new Error(`CRM API request failed: ${response.status}`);
  }

  const payload = await response.json();
  return parse(payload);
}

function buildTaskQueryString(query: ListCrmTasksQuery): string {
  const searchParams = new URLSearchParams();

  if (query.assigneeUserId) {
    searchParams.set("assigneeUserId", query.assigneeUserId);
  }
  if (query.completed !== undefined) {
    searchParams.set("completed", query.completed ? "true" : "false");
  }
  if (query.dateTo) {
    searchParams.set("dateTo", query.dateTo);
  }
  if (query.includeNoDueDate) {
    searchParams.set("includeNoDueDate", "true");
  }
  if (query.dealId) {
    searchParams.set("dealId", query.dealId);
  }

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

export async function listCrmTasks(
  query: ListCrmTasksQuery = {},
): Promise<CrmTask[]> {
  const response = await crmApiFetch(
    `/tasks${buildTaskQueryString(query)}`,
    { method: "GET" },
    (payload) => ListCrmTasksResponseSchema.parse(payload),
  );

  return response.data;
}

export async function createCrmTask(
  input: CreateCrmTaskInput,
): Promise<CrmTask> {
  return crmApiFetch(
    "/tasks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    (payload) => CrmTaskSchema.parse(payload),
  );
}

export async function updateCrmTask(
  id: string,
  input: UpdateCrmTaskInput,
): Promise<CrmTask> {
  return crmApiFetch(
    `/tasks/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    (payload) => CrmTaskSchema.parse(payload),
  );
}

export async function deleteCrmTask(id: string): Promise<void> {
  await crmApiFetch(
    `/tasks/${id}`,
    { method: "DELETE" },
    () => undefined,
  );
}

export async function reorderCrmTasks(
  input: ReorderCrmTasksInput,
): Promise<void> {
  await crmApiFetch(
    "/tasks/reorder",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    () => undefined,
  );
}

export async function getCrmTaskCalendar(
  query: CalendarCrmTasksQuery,
) {
  const searchParams = new URLSearchParams({ month: query.month });

  if (query.assigneeUserId) {
    searchParams.set("assigneeUserId", query.assigneeUserId);
  }

  return crmApiFetch(
    `/tasks/calendar?${searchParams.toString()}`,
    { method: "GET" },
    (payload) => CalendarCrmTasksResponseSchema.parse(payload),
  );
}

export async function getCrmTaskCapabilities(): Promise<CrmTaskCapabilities> {
  return crmApiFetch(
    "/tasks/capabilities",
    { method: "GET" },
    (payload) => CrmTaskCapabilitiesSchema.parse(payload),
  );
}
