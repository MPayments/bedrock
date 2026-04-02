import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFinanceDealWorkbenchById = vi.fn();
const renderWorkbench = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/deals/lib/queries", () => ({
  getFinanceDealWorkbenchById,
}));

vi.mock("@/features/treasury/deals/components/workbench", () => ({
  FinanceDealWorkbench: (props: unknown) => {
    renderWorkbench(props);
    return createElement("section");
  },
}));

describe("treasury deal workspace page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getFinanceDealWorkbenchById.mockResolvedValue({
      summary: {
        applicantDisplayName: "ООО Ромашка",
        calculationId: null,
        createdAt: "2026-04-02T08:07:00.000Z",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        internalEntityDisplayName: "Мультиханса",
        status: "draft",
        type: "payment",
        updatedAt: "2026-04-02T08:07:00.000Z",
      },
    });
  });

  it("loads the treasury workbench and passes it to the workbench component", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { default: TreasuryDealWorkspacePage } = await import(
      "@/app/(shell)/treasury/deals/[id]/page"
    );

    renderToStaticMarkup(
      await TreasuryDealWorkspacePage({
        params: Promise.resolve({
          id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        }),
      }),
    );

    expect(getFinanceDealWorkbenchById).toHaveBeenCalledWith(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
    expect(renderWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        deal: expect.objectContaining({
          summary: expect.objectContaining({
            applicantDisplayName: "ООО Ромашка",
            id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            type: "payment",
          }),
        }),
      }),
    );
  });
});
