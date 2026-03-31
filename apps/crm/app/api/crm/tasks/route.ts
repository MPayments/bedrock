import { NextRequest, NextResponse } from "next/server";

import { requireCrmApiSession } from "@/lib/server/auth";
import {
  createCrmTask,
  listCrmTasks,
} from "@/lib/server/tasks/service";
import {
  CreateCrmTaskInputSchema,
  ListCrmTasksQuerySchema,
  ListCrmTasksResponseSchema,
} from "@/lib/tasks/contracts";

export const dynamic = "force-dynamic";

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message === "Forbidden") {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (message.startsWith("Unknown ")) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const auth = await requireCrmApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  const searchParams = request.nextUrl.searchParams;
  const parsedQuery = ListCrmTasksQuerySchema.safeParse({
    assigneeUserId: searchParams.get("assigneeUserId") ?? undefined,
    completed: parseBooleanParam(searchParams.get("completed")),
    dateTo: searchParams.get("dateTo") ?? undefined,
    includeNoDueDate: parseBooleanParam(searchParams.get("includeNoDueDate")),
    dealId: searchParams.get("dealId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const tasks = await listCrmTasks(auth.value, parsedQuery.data);
    return NextResponse.json(
      ListCrmTasksResponseSchema.parse({ data: tasks }),
      { status: 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCrmApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  const payload = await request.json().catch(() => null);
  const parsedInput = CreateCrmTaskInputSchema.safeParse(payload);

  if (!parsedInput.success) {
    return NextResponse.json(
      { error: parsedInput.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const task = await createCrmTask(auth.value, parsedInput.data);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
