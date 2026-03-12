import { createClient, type Client } from "@multihansa/api-client";

export const apiClient: Client = createClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002",
);
