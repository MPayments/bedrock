import { NextRequest, NextResponse } from "next/server";

import { requireCrmApiSession } from "@/lib/server/auth";
import {
  deleteCrmTask,
  updateCrmTask,
} from "@/lib/server/tasks/service";
import {
  DeleteCrmTaskResponseSchema,
  UpdateCrmTaskInputSchema,
} from "@/lib/tasks/contracts";

export const dynamic = "force-dynamic";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message === "Forbidden") {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (message === "Not found") {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  if (message.startsWith("Unknown ")) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireCrmApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  const payload = await request.json().catch(() => null);
  const parsedInput = UpdateCrmTaskInputSchema.safeParse(payload);

  if (!parsedInput.success) {
    return NextResponse.json(
      { error: parsedInput.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const task = await updateCrmTask(auth.value, id, parsedInput.data);
    return NextResponse.json(task, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const auth = await requireCrmApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    await deleteCrmTask(auth.value, id);
    return NextResponse.json(
      DeleteCrmTaskResponseSchema.parse({ deleted: true }),
      { status: 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
