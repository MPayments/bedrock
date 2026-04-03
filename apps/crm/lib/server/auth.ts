import "server-only";

import { NextResponse } from "next/server";

import { getServerSessionSnapshot } from "@/lib/auth/session";
import type { UserSessionSnapshot } from "@/lib/auth/types";

export type CrmApiSession = {
  currentUserId: string;
  isAdmin: boolean;
  session: UserSessionSnapshot;
};

export async function requireCrmApiSession(): Promise<
  | { ok: true; value: CrmApiSession }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSessionSnapshot();

  if (!session.isAuthenticated || !session.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!session.canAccessDashboard) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    value: {
      currentUserId: session.user.id,
      isAdmin: session.role === "admin",
      session,
    },
  };
}
