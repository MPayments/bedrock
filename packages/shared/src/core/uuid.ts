export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function formatCompactId(value: string): string {
  const normalized = value.trim();
  const [prefix = ""] = normalized.split("-", 1);

  return prefix.toUpperCase();
}

export function getUuidPrefix(value: string): string {
  return isUuidLike(value) ? value.slice(0, 8) : value;
}
