import { hc } from "hono/client";
import type { AppType } from "./index.js";

export type Client = ReturnType<typeof hc<AppType>>;

export function createClient(
  baseUrl: string,
  options?: Parameters<typeof hc>[1]
): Client {
  return hc<AppType>(baseUrl, options);
}