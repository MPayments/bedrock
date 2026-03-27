export function resolveApiPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
