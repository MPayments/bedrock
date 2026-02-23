import { createClient } from "api/client";

export const apiClient = createClient(process.env.NEXT_PUBLIC_API_URL!);
