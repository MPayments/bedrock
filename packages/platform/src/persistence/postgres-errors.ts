export function hasPostgresErrorCode(
  error: unknown,
  code: string,
): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { cause?: unknown; code?: unknown };
  if (candidate.code === code) {
    return true;
  }

  return hasPostgresErrorCode(candidate.cause, code);
}

export function hasPostgresForeignKeyViolation(error: unknown): boolean {
  return hasPostgresErrorCode(error, "23503");
}
