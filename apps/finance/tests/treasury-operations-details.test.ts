import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TreasuryOperationDetailsView } from "@/features/treasury/operations/components/details";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => undefined,
  }),
}));

describe("treasury operations details", () => {
  it("renders an operation panel with localized blocker text and a deal back-link", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(TreasuryOperationDetailsView, {
        operation: {
          actions: {
            canPrepareInstruction: false,
            canRequestReturn: false,
            canRetryInstruction: false,
            canSubmitInstruction: false,
            canVoidInstruction: false,
          },
          amount: {
            amountMinor: "12500000",
            currency: "USD",
            currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
            formatted: "125 000 USD",
          },
          availableOutcomeTransitions: [],
          counterAmount: null,
          createdAt: "2026-04-03T10:00:00.000Z",
          dealRef: {
            applicantName: "ООО Тест",
            dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            status: "executing",
            type: "payment",
          },
          dealWorkbenchHref: "/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          destinationAccount: {
            identity: "40702810900000000001",
            label: "USD settlement",
          },
          id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          instructionStatus: "blocked",
          internalEntity: {
            name: "Multihansa",
            organizationId: "fdcf4040-4a4e-4c90-b550-6898ab3789f1",
          },
          kind: "payout",
          legRef: {
            idx: 2,
            kind: "payout",
            legId: "214fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          },
          latestInstruction: null,
          nextAction: "Prepare documents",
          providerRoute: "Route A -> B",
          queueContext: {
            blockers: ["Required deal header sections are incomplete"],
            queue: "funding",
            queueReason: "Required deal header sections are incomplete",
          },
          sourceAccount: {
            identity: null,
            label: "Multihansa",
          },
          sourceRef: "deal:614fb6eb-a1bd-429e-9628-e97d0f2efa0b:leg:2:payout:1",
          state: "planned",
        },
      }),
    );

    expect(markup).toContain("Сводка операции");
    expect(markup).toContain("Маршрут и блокеры");
    expect(markup).toContain("Перейти к сделке");
    expect(markup).toContain("Выплата");
    expect(markup).toContain("Заголовок сделки заполнен не полностью.");
    expect(markup).not.toContain(
      "Required deal header sections are incomplete",
    );
  });
});
