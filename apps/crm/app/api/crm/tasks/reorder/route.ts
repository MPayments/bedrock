import { NextRequest, NextResponse } from "next/server";

import { requireCrmApiSession } from "@/lib/server/auth";
import { reorderCrmTasks } from "@/lib/server/tasks/service";
import {
  ReorderCrmTasksInputSchema,
  ReorderCrmTasksResponseSchema,
} from "@/lib/tasks/contracts";

export const dynamic = "force-dynamic";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message === "Forbidden") {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (
    message === "Some tasks were not found"
    || message === "Tasks must share the same assignee"
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const auth = await requireCrmApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  const payload = await request.json().catch(() => null);
  const parsedInput = ReorderCrmTasksInputSchema.safeParse(payload);

  if (!parsedInput.success) {
    return NextResponse.json(
      { error: parsedInput.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await reorderCrmTasks(auth.value, parsedInput.data.orderedTaskIds);
    return NextResponse.json(
      ReorderCrmTasksResponseSchema.parse({ success: true }),
      { status: 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
