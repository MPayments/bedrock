import { hc } from "hono/client";

import type { AppType } from "./app";

export type Client = ReturnType<typeof hc<AppType>>;

export function createClient(
  baseUrl: string,
): Client {
  return hc<AppType>(baseUrl, {
    init: {
      credentials: "include",
    },
  });
}