import React, { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFinanceDealWorkspaceById = vi.fn();
const renderWorkspaceLayout = vi.fn<
  (props: { children?: ReactNode; title: string }) => void
>();
const renderWorkspaceView = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/deals/lib/queries", () => ({
  getFinanceDealWorkspaceById,
}));

vi.mock("@/features/treasury/deals/components/workspace-layout", () => ({
  FinanceDealWorkspaceLayout: (props: {
    children?: ReactNode;
    title: string;
  }) => {
    renderWorkspaceLayout(props);
    return createElement("section", null, props.children);
  },
}));

vi.mock("@/features/treasury/deals/components/workspace-view", () => ({
  FinanceDealWorkspaceView: (props: unknown) => {
    renderWorkspaceView(props);
    return null;
  },
}));

describe("treasury deal workspace page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getFinanceDealWorkspaceById.mockResolvedValue({
      summary: {
        applicantDisplayName: "ООО Ромашка",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "payment",
      },
    });
  });

  it("loads the deal workspace and passes the localized title to the layout", async () => {
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

    expect(getFinanceDealWorkspaceById).toHaveBeenCalledWith(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
    expect(renderWorkspaceLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Платеж поставщику • ООО Ромашка",
      }),
    );
    expect(renderWorkspaceView).toHaveBeenCalledWith(
      expect.objectContaining({
        deal: expect.objectContaining({
          summary: expect.objectContaining({
            id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          }),
        }),
      }),
    );
  });
});
