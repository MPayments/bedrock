import type {
  DocumentFormField,
  DocumentFormResponsiveCount,
  DocumentFormRowField,
  DocumentFormSection,
} from "./types";

type ResolvedDocumentFormRowField = {
  field: DocumentFormField;
  span?: DocumentFormResponsiveCount;
};

type ResolvedDocumentFormRow = {
  fields: ResolvedDocumentFormRowField[];
  columns?: DocumentFormResponsiveCount;
};

function readRowFieldName(field: DocumentFormRowField): string {
  return typeof field === "string" ? field : field.name;
}

function readRowFieldSpan(
  field: DocumentFormRowField,
): DocumentFormResponsiveCount | undefined {
  return typeof field === "string" ? undefined : field.span;
}

export function resolveDocumentFormSectionRows(
  section: DocumentFormSection,
): ResolvedDocumentFormRow[] {
  const fieldByName = new Map(
    section.fields.map((field) => [field.name, field] as const),
  );
  const seenFieldNames = new Set<string>();
  const rows: ResolvedDocumentFormRow[] = [];

  for (const row of section.layout?.rows ?? []) {
    const resolvedFields: ResolvedDocumentFormRowField[] = [];

    for (const rowField of row.fields) {
      const fieldName = readRowFieldName(rowField);
      if (seenFieldNames.has(fieldName)) {
        continue;
      }

      const field = fieldByName.get(fieldName);
      if (!field) {
        continue;
      }

      seenFieldNames.add(fieldName);
      resolvedFields.push({
        field,
        span: readRowFieldSpan(rowField),
      });
    }

    if (resolvedFields.length > 0) {
      rows.push({
        columns: row.columns,
        fields: resolvedFields,
      });
    }
  }

  for (const field of section.fields) {
    if (seenFieldNames.has(field.name)) {
      continue;
    }

    seenFieldNames.add(field.name);
    rows.push({
      fields: [{ field }],
    });
  }

  return rows;
}
