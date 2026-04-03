import "server-only";

import { NextResponse } from "next/server";

const KNOWN_CLIENT_ERRORS: Record<string, number> = {
  Forbidden: 403,
  "Not found": 404,
  "Some tasks were not found": 400,
  "Tasks must share the same assignee": 400,
};

export function toSafeErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";

  if (message.startsWith("Unknown ")) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const status = KNOWN_CLIENT_ERRORS[message];
  if (status) {
    return NextResponse.json({ error: message }, { status });
  }

  console.error("[CRM API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
