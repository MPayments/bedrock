import { createClient } from "api/client";

const API_URL = process.env.API_URL ?? "http://localhost:3002";

export const apiClient = createClient(API_URL);
