import { NextRequest, NextResponse } from "next/server";

import { toSafeErrorResponse } from "@/lib/server/api-error";
import { requireCrmApiSession } from "@/lib/server/auth";
import { getCrmTaskCalendar } from "@/lib/server/tasks/service";
import {
  CalendarCrmTasksQuerySchema,
  CalendarCrmTasksResponseSchema,
} from "@/lib/tasks/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCrmApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  const parsedQuery = CalendarCrmTasksQuerySchema.safeParse({
    month: request.nextUrl.searchParams.get("month") ?? undefined,
    assigneeUserId:
      request.nextUrl.searchParams.get("assigneeUserId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const calendar = await getCrmTaskCalendar(auth.value, parsedQuery.data);
    return NextResponse.json(
      CalendarCrmTasksResponseSchema.parse(calendar),
      { status: 200 },
    );
  } catch (error) {
    return toSafeErrorResponse(error);
  }
}
