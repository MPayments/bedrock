import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTreasuryOperationById = vi.fn();
const renderDetails = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/operations/lib/queries", () => ({
  getTreasuryOperationById,
}));

vi.mock("@/features/treasury/operations/components/details", () => ({
  TreasuryOperationDetailsView: (props: unknown) => {
    renderDetails(props);
    return createElement("section");
  },
}));

describe("treasury operation workspace page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getTreasuryOperationById.mockResolvedValue({
      dealRef: {
        applicantName: "ООО Тест",
        dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        status: "executing",
        type: "payment",
      },
      id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      kind: "payout",
    });
  });

  it("loads the treasury operation and passes it to the detail view", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { default: TreasuryOperationWorkspacePage } = await import(
      "@/app/(shell)/treasury/operations/[id]/page"
    );

    renderToStaticMarkup(
      await TreasuryOperationWorkspacePage({
        params: Promise.resolve({
          id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        }),
      }),
    );

    expect(getTreasuryOperationById).toHaveBeenCalledWith(
      "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
    expect(renderDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: expect.objectContaining({
          id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          kind: "payout",
        }),
      }),
    );
  });
});
