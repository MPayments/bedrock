import { describe, expect, it } from "vitest";

import {
  buildPrintFormUrl,
  readFilenameFromContentDisposition,
} from "../src/lib/client";

describe("print form client helpers", () => {
  it("builds owner-scoped print form download urls", () => {
    expect(
      buildPrintFormUrl({
        baseUrl: "/v1/",
        formId: "document.invoice-ru",
        format: "pdf",
        owner: {
          type: "document",
          docType: "invoice",
          documentId: "document-1",
        },
      }),
    ).toBe(
      "/v1/documents/invoice/document-1/print-forms/document.invoice-ru?format=pdf",
    );
  });

  it("reads utf8 filenames from content disposition", () => {
    expect(
      readFilenameFromContentDisposition(
        "attachment; filename*=UTF-8''%D0%A1%D1%87%D0%B5%D1%82.pdf",
      ),
    ).toBe("\u0421\u0447\u0435\u0442.pdf");
  });

  it("reads quoted filenames from content disposition", () => {
    expect(
      readFilenameFromContentDisposition('attachment; filename="invoice.pdf"'),
    ).toBe("invoice.pdf");
  });
});
