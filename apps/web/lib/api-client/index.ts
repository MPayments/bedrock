import type { AppType } from "multihansa-api/types";
import { hc } from "hono/client";

export type Client = ReturnType<typeof hc<AppType>>;

export interface CreateClientOptions {
  headers?: Record<string, string>;
  init?: RequestInit;
}

export function createClient(
  baseUrl: string,
  options?: CreateClientOptions,
): Client {
  return hc<AppType>(baseUrl, {
    headers: options?.headers,
    init: {
      credentials: "include",
      ...options?.init,
    },
  });
}
