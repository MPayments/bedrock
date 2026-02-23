import { Client, createClient } from "api/client";

export const apiClient: Client = createClient(process.env.NEXT_PUBLIC_API_URL!);
