import type { AppType } from "api/types";
import { hc } from "hono/client";

export interface CreateClientOptions {
  headers?: Record<string, string>;
  init?: RequestInit;
}

export type Client = ReturnType<typeof hc<AppType>>;

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
  }) as Client;
}
