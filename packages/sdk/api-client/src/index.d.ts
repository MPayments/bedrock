import type { AppType } from "api/types";
import { hc } from "hono/client";
export interface CreateClientOptions {
    headers?: Record<string, string>;
    init?: RequestInit;
}
export declare function createClient(baseUrl: string, options?: CreateClientOptions): ReturnType<typeof hc<AppType>>;
//# sourceMappingURL=index.d.ts.map
