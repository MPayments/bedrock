import { createClient, type Client } from "@bedrock/client-api";

export const apiClient: Client = createClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002",
);
