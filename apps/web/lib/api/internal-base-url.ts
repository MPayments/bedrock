import { resolveApiPath } from "./path";

const DEFAULT_INTERNAL_API_BASE_URL = "http://localhost:3002";

export function resolveInternalApiBaseUrl(): string {
  return (
    process.env.BEDROCK_INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_INTERNAL_API_BASE_URL
  );
}

export function resolveInternalApiUrl(path: string): string {
  return `${resolveInternalApiBaseUrl()}${resolveApiPath(path)}`;
}
