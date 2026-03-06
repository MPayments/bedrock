import { describe, expect, it } from "vitest";

import { resolveDocumentFormSectionRows } from "@/features/documents/lib/document-form-registry/layout";
import type { DocumentFormSection } from "@/features/documents/lib/document-form-registry/types";

describe("resolveDocumentFormSectionRows", () => {
  it("falls back to stacked rows when layout metadata is missing", () => {
    const section: DocumentFormSection = {
      id: "main",
      title: "Main",
      fields: [
        { kind: "text", name: "first", label: "First" },
        { kind: "text", name: "second", label: "Second" },
      ],
    };

    expect(resolveDocumentFormSectionRows(section)).toEqual([
      {
        fields: [
          {
            field: section.fields[0],
          },
        ],
      },
      {
        fields: [
          {
            field: section.fields[1],
          },
        ],
      },
    ]);
  });

  it("preserves explicit row order, columns, and spans", () => {
    const section: DocumentFormSection = {
      id: "main",
      title: "Main",
      fields: [
        { kind: "text", name: "first", label: "First" },
        { kind: "text", name: "second", label: "Second" },
      ],
      layout: {
        rows: [
          {
            columns: { base: 1, sm: 2 },
            fields: [
              "second",
              {
                name: "first",
                span: { sm: 2 },
              },
            ],
          },
        ],
      },
    };

    expect(resolveDocumentFormSectionRows(section)).toEqual([
      {
        columns: { base: 1, sm: 2 },
        fields: [
          {
            field: section.fields[1],
          },
          {
            field: section.fields[0],
            span: { sm: 2 },
          },
        ],
      },
    ]);
  });

  it("appends unreferenced fields as fallback rows", () => {
    const section: DocumentFormSection = {
      id: "main",
      title: "Main",
      fields: [
        { kind: "text", name: "first", label: "First" },
        { kind: "text", name: "second", label: "Second" },
        { kind: "text", name: "third", label: "Third" },
      ],
      layout: {
        rows: [
          {
            fields: ["second"],
          },
        ],
      },
    };

    expect(
      resolveDocumentFormSectionRows(section).map((row) =>
        row.fields.map(({ field }) => field.name),
      ),
    ).toEqual([["second"], ["first"], ["third"]]);
  });

  it("skips duplicate references after the first occurrence", () => {
    const section: DocumentFormSection = {
      id: "main",
      title: "Main",
      fields: [
        { kind: "text", name: "first", label: "First" },
        { kind: "text", name: "second", label: "Second" },
        { kind: "text", name: "third", label: "Third" },
      ],
      layout: {
        rows: [
          {
            fields: ["first", "second"],
          },
          {
            fields: ["first", "third"],
          },
        ],
      },
    };

    expect(
      resolveDocumentFormSectionRows(section).map((row) =>
        row.fields.map(({ field }) => field.name),
      ),
    ).toEqual([["first", "second"], ["third"]]);
  });

  it("ignores missing field references in layout metadata", () => {
    const section: DocumentFormSection = {
      id: "main",
      title: "Main",
      fields: [{ kind: "text", name: "first", label: "First" }],
      layout: {
        rows: [
          {
            fields: ["missing", "first"],
          },
        ],
      },
    };

    expect(
      resolveDocumentFormSectionRows(section).map((row) =>
        row.fields.map(({ field }) => field.name),
      ),
    ).toEqual([["first"]]);
  });
});
