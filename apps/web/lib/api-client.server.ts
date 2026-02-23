import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { createClient } from "api/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

/**
 * Server-side API client with per-request cookie forwarding.
 * Uses React.cache() so headers() is resolved once per request
 * regardless of how many server components call this function.
 */
export const getServerApiClient = cache(async () => {
  const h = await headers();
  return createClient(API_URL, {
    headers: { cookie: h.get("cookie") ?? "" },
    init: { cache: "no-store" },
  });
});
