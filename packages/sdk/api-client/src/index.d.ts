import type { hc } from "hono/client";

import type { AppType } from "../../../../apps/api/dist/types";
export type Client = ReturnType<typeof hc<AppType>>;
export interface CreateClientOptions {
  headers?: Record<string, string>;
  init?: RequestInit;
}
export declare function createClient(
  baseUrl: string,
  options?: CreateClientOptions,
): Client;
//# sourceMappingURL=index.d.ts.map
