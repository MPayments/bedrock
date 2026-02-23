import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // baseURL: process.env.NEXT_PUBLIC_API_URL!,
  baseURL: "http://localhost:3002",
  basePath: "/api/auth",
});
