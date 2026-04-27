import React, { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TreasuryOperationDetailsView } from "@/features/treasury/operations/components/details";
import type { TreasuryPaymentStepOperation } from "@/features/treasury/operations/lib/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => undefined,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children?: ReactNode;
    href?: string;
  }) => createElement("a", { href }, children),
}));

vi.mock("lucide-react", () => ({
  ArrowUpRight: () => null,
  ArrowRight: () => null,
  Check: () => null,
  Loader2: () => null,
  MoreHorizontal: () => null,
  TriangleAlert: () => null,
  Workflow: () => null,
}));

vi.mock("@/features/treasury/steps/components/step-card", () => ({
  StepCard: ({ step, title }: { step: { id: string }; title?: string }) =>
    createElement(
      "div",
      { "data-testid": `finance-step-card-${step.id}` },
      title,
    ),
}));

vi.mock("@/features/treasury/steps/components/step-attempts-drawer", () => ({
  StepAttemptsDrawer: () => null,
}));

vi.mock("@bedrock/sdk-ui/components/button", () => ({
  Button: ({
    children,
    render,
  }: {
    children?: ReactNode;
    render?: ReactNode;
  }) =>
    React.isValidElement(render)
      ? React.cloneElement(render, undefined, children)
      : createElement(Fragment, null, children),
}));

vi.mock("@/components/entities/workspace-layout", () => ({
  EntityWorkspaceLayout: ({
    title,
    subtitle,
    controls,
    children,
  }: {
    title?: ReactNode;
    subtitle?: ReactNode;
    controls?: ReactNode;
    children?: ReactNode;
  }) =>
    createElement(
      "div",
      null,
      createElement("h1", null, title),
      createElement("p", null, subtitle),
      controls,
      children,
    ),
}));

function createDealLegStep(): TreasuryPaymentStepOperation {
  return {
    amendments: [],
    artifacts: [],
    attempts: [],
    completedAt: null,
    createdAt: "2026-04-03T10:00:00.000Z",
    currentRoute: {
      fromAmountMinor: "12500000",
      fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      fromParty: {
        id: "00000000-0000-4000-8000-000000000001",
        requisiteId: null,
      },
      rate: null,
      toAmountMinor: "12500000",
      toCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      toParty: {
        id: "00000000-0000-4000-8000-000000000002",
        requisiteId: null,
      },
    },
    dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    failureReason: null,
    fromAmountMinor: "12500000",
    fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
    fromParty: {
      id: "00000000-0000-4000-8000-000000000001",
      requisiteId: null,
    },
    id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    kind: "payout",
    origin: {
      dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      planLegId: "plan-leg-1",
      routeSnapshotLegId: null,
      sequence: 1,
      treasuryOrderId: null,
      type: "deal_execution_leg",
    },
    plannedRoute: {
      fromAmountMinor: "12500000",
      fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      fromParty: {
        id: "00000000-0000-4000-8000-000000000001",
        requisiteId: null,
      },
      rate: null,
      toAmountMinor: "12500000",
      toCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      toParty: {
        id: "00000000-0000-4000-8000-000000000002",
        requisiteId: null,
      },
    },
    postingDocumentRefs: [],
    purpose: "deal_leg",
    quoteId: null,
    rate: null,
    returns: [],
    runtimeType: "payment_step",
    scheduledAt: null,
    sourceRef: "deal:614fb6eb-a1bd-429e-9628-e97d0f2efa0b:plan-leg:plan-leg-1:payout:1",
    state: "pending",
    submittedAt: null,
    toAmountMinor: "12500000",
    toCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
    toParty: {
      id: "00000000-0000-4000-8000-000000000002",
      requisiteId: null,
    },
    treasuryBatchId: null,
    updatedAt: "2026-04-03T10:00:00.000Z",
  };
}

describe("treasury operations details", () => {
  it("renders StepCard with deal-context subtitle and a deal back-link", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(TreasuryOperationDetailsView, {
        operation: createDealLegStep(),
      }),
    );

    expect(markup).toContain(
      'data-testid="finance-step-card-114fb6eb-a1bd-429e-9628-e97d0f2efa0b"',
    );
    expect(markup).toContain("Платёжный шаг");
    expect(markup).toContain("Перейти к сделке");
    expect(markup).toContain(
      'href="/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b"',
    );
  });

  it("hides the deal back-link for standalone payment steps", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const step: TreasuryPaymentStepOperation = {
      ...createDealLegStep(),
      dealId: null,
      origin: {
        dealId: null,
        planLegId: null,
        routeSnapshotLegId: null,
        sequence: null,
        treasuryOrderId: null,
        type: "manual",
      },
      purpose: "standalone_payment",
      kind: "internal_transfer",
    };

    const markup = renderToStaticMarkup(
      createElement(TreasuryOperationDetailsView, {
        operation: step,
      }),
    );

    expect(markup).toContain("Отдельная казначейская операция");
    expect(markup).not.toContain("Перейти к сделке");
  });
});
