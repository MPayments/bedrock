import { hc } from "hono/client";

import type { AppType } from "./app";

export type Client = ReturnType<typeof hc<AppType>>;

export type CreateClientOptions = {
  headers?: Record<string, string>;
  init?: RequestInit;
};

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