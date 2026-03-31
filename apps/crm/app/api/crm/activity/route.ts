import { NextRequest, NextResponse } from "next/server";

import { CrmActivityResponseSchema } from "@/lib/activity/contracts";
import { toSafeErrorResponse } from "@/lib/server/api-error";
import { requireCrmApiSession } from "@/lib/server/auth";
import { loadCrmActivity } from "@/lib/server/activity/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCrmApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  const parsedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 50))
    : 10;

  try {
    const response = await loadCrmActivity(limit);
    return NextResponse.json(CrmActivityResponseSchema.parse(response), {
      status: 200,
    });
  } catch (error) {
    return toSafeErrorResponse(error);
  }
}
