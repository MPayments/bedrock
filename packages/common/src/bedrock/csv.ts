function asCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const rendered = typeof value === "string" ? value : String(value);
  if (!/[",\n\r]/u.test(rendered)) {
    return rendered;
  }

  return `"${rendered.replaceAll('"', '""')}"`;
}

export function toCsvContent(
  headers: readonly string[],
  rows: readonly Record<string, unknown>[],
): string {
  const head = headers.join(",");
  const body = rows.map((row) =>
    headers.map((key) => asCsvCell(row[key])).join(","),
  );
  return [head, ...body].join("\n");
}
