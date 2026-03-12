type CsvResponder = {
  body: (
    body: string,
    status: number,
    headers: Record<string, string>,
  ) => Response;
};

function asCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const rendered = typeof value === "string" ? value : String(value);
  if (!/[",\n\r]/.test(rendered)) {
    return rendered;
  }

  return `"${rendered.replaceAll("\"", "\"\"")}"`;
}

export function toCsvContent(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const head = headers.join(",");
  const body = rows.map((row) =>
    headers.map((key) => asCsvCell(row[key])).join(","),
  );
  return [head, ...body].join("\n");
}

export function toReportCsvResponse(
  c: CsvResponder,
  input: {
    filename: string;
    headers: string[];
    rows: Record<string, unknown>[];
  },
) {
  return c.body(toCsvContent(input.headers, input.rows), 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${input.filename}"`,
  });
}
