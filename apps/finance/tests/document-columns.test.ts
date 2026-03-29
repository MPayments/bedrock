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

  it("uses a warning badge for pending approval status", () => {
    const columns = getDocumentColumns([]);
    const approvalColumn = columns.find(
      (column) =>
        "accessorKey" in column && column.accessorKey === "approvalStatus",
    );
    expect(typeof approvalColumn?.cell).toBe("function");

    if (typeof approvalColumn?.cell !== "function") {
      throw new Error("approvalStatus column should provide a cell renderer");
    }

    const cellContext = {
      row: {
        original: {
          approvalStatus: "pending",
        },
      },
    } as Parameters<typeof approvalColumn.cell>[0];

    const badge = approvalColumn.cell({
      ...cellContext,
    }) as {
      props?: {
        variant?: string;
      };
    };

    expect(badge?.props?.variant).toBe("warning");
  });
});
