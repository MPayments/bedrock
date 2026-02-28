import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { createClient, type Client } from "@bedrock/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

/**
 * Server-side API client with per-request cookie forwarding.
 * Uses React.cache() so headers() is resolved once per request
 * regardless of how many server components call this function.
 */
const createServerApiClient = async (): Promise<Client> => {
  const h = await headers();
  return createClient(API_URL, {
    headers: { cookie: h.get("cookie") ?? "" },
    init: { cache: "no-store" },
  });
};

export const getServerApiClient = cache(createServerApiClient);
