import { createApiClient, type ApiClient } from "@bedrock/client";
import type { AppType } from "multihansa-api/types";

type V1CompatClient = Record<string, any> & {
  accounting: any;
  currencies: any;
  me: any;
  parties: any;
  treasury: any;
  users: any;
  "counterparty-groups": any;
};

export type Client = ApiClient<AppType> & {
  v1: V1CompatClient;
};

interface CreateClientOptions {
  headers?:
    | HeadersInit
    | (() => HeadersInit | Promise<HeadersInit>);
  init?: Omit<RequestInit, "body" | "headers" | "method">;
}

export function createClient(
  baseUrl: string,
  options?: CreateClientOptions,
): Client {
  const client = createApiClient<AppType>({
    baseUrl,
    headers: options?.headers,
    init: {
      credentials: "include",
      ...options?.init,
    },
  });

  return Object.assign(client, {
    v1: client as unknown as V1CompatClient,
  }) as Client;
}
