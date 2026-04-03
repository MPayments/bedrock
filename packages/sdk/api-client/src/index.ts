import { hc } from "hono/client";

export interface CreateClientOptions {
  headers?: Record<string, string>;
  init?: RequestInit;
}

const createUntypedClient = hc as (
  baseUrl: string,
  options?: {
    headers?: Record<string, string>;
    init?: RequestInit;
  },
) => unknown;

export function createClient(
  baseUrl: string,
  options?: CreateClientOptions,
) {
  return createUntypedClient(baseUrl, {
    headers: options?.headers,
    init: {
      credentials: "include",
      ...options?.init,
    },
  });
}
