import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const renderEntityTableShell = vi.fn<(props: unknown) => null>(() => null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

vi.mock("@/components/entities/entity-table-shell", () => ({
  EntityTableShell: (props: unknown) => {
    renderEntityTableShell(props);
    return null;
  },
}));

describe("finance deals table", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("passes table configuration and opens the deal page on row double click", async () => {
    const { FinanceDealsTable } = await import(
      "@/features/treasury/deals/components/table"
    );

    renderToStaticMarkup(
      createElement(FinanceDealsTable, {
        promise: Promise.resolve({
          data: [],
          total: 0,
          limit: 10,
          offset: 0,
        }),
      }),
    );

    expect(renderEntityTableShell).toHaveBeenCalledTimes(1);

    const props = renderEntityTableShell.mock.calls[0]?.[0] as unknown as {
      columns: Array<{ accessorKey?: string; id?: string }>;
      getRowId: (row: { dealId: string }) => string;
      initialState: {
        sorting: Array<{ id: string; desc: boolean }>;
      };
      onRowDoubleClick: (row: { original: { dealId: string } }) => void;
    };

    expect(props.columns.map((column) => column.accessorKey ?? column.id)).toEqual([
      "applicantName",
      "internalEntityName",
      "queue",
      "stage",
      "type",
      "status",
      "blockerState",
      "nextAction",
      "executionSummary",
      "documentSummary",
      "createdAt",
      "actions",
    ]);
    expect(props.initialState).toEqual({
      columnVisibility: {
        blockerState: false,
      },
      sorting: [{ id: "createdAt", desc: true }],
    });
    expect(props.getRowId({ dealId: "deal-1" })).toBe("deal-1");

    props.onRowDoubleClick({
      original: {
        dealId: "deal-1",
      },
    });

    expect(push).toHaveBeenCalledWith("/treasury/deals/deal-1");
  });
});
