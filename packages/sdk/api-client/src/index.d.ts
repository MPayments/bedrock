import type { AppType } from "api/types";
import { hc } from "hono/client";
export type Client = ReturnType<typeof hc<AppType>>;
export interface CreateClientOptions {
    headers?: Record<string, string>;
    init?: RequestInit;
}
export declare function createClient(baseUrl: string, options?: CreateClientOptions): Client;
//# sourceMappingURL=index.d.ts.map