import { NextRequest, NextResponse } from "next/server";

import { toSafeErrorResponse } from "@/lib/server/api-error";
import { requireCrmApiSession } from "@/lib/server/auth";
import { reorderCrmTasks } from "@/lib/server/tasks/service";
import {
  ReorderCrmTasksInputSchema,
  ReorderCrmTasksResponseSchema,
} from "@/lib/tasks/contracts";

export const dynamic = "force-dynamic";

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
    return toSafeErrorResponse(error);
  }
}
