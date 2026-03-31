import { NextResponse } from "next/server";

import { requireCrmApiSession } from "@/lib/server/auth";
import { CrmTaskCapabilitiesSchema } from "@/lib/tasks/contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireCrmApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json(
    CrmTaskCapabilitiesSchema.parse({
      currentUserId: auth.value.currentUserId,
      canAssignOthers: auth.value.isAdmin,
    }),
    { status: 200 },
  );
}
