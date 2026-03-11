import { describe, expect, it } from "vitest";

import { getDocumentColumns } from "@/features/documents/components/columns";

describe("document columns", () => {
  it("exposes provided doc type options in the type filter", () => {
    const docTypeOptions = [
      { value: "transfer_intra", label: "Внутренний перевод" },
      { value: "transfer_resolution", label: "Разрешение перевода" },
    ];

    const columns = getDocumentColumns(docTypeOptions);
    const docTypeColumn = columns.find(
      (column) => "accessorKey" in column && column.accessorKey === "docType",
    );

    expect(docTypeColumn?.meta?.options).toEqual(docTypeOptions);
    expect(docTypeColumn?.meta?.filterContentClassName).toBe("w-72");
  });
});
