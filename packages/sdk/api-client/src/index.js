import { hc } from "hono/client";
export function createClient(baseUrl, options) {
    return hc(baseUrl, {
        headers: options?.headers,
        init: {
            credentials: "include",
            ...options?.init,
        },
    });
}
