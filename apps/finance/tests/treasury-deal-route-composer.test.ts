import React, { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FinanceRouteComposerData } from "@/features/treasury/deals/lib/queries";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
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
  AlertCircle: () => null,
  Calculator: () => null,
  Check: () => null,
  ChevronsUpDown: () => null,
  Plus: () => null,
  RotateCcw: () => null,
  Save: () => null,
  Workflow: () => null,
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
      : createElement("button", null, children),
}));

vi.mock("@bedrock/sdk-ui/components/card", () => ({
  Card: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardContent: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardDescription: ({ children }: { children?: ReactNode }) =>
    createElement("p", null, children),
  CardHeader: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardTitle: ({ children }: { children?: ReactNode }) =>
    createElement("h3", null, children),
}));

vi.mock("@bedrock/sdk-ui/components/checkbox", () => ({
  Checkbox: ({ checked }: { checked?: boolean }) =>
    createElement("input", { type: "checkbox", checked }),
}));

vi.mock("@bedrock/sdk-ui/components/command", () => ({
  Command: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CommandEmpty: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  CommandGroup: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CommandInput: () => null,
  CommandItem: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  CommandList: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
}));

vi.mock("@bedrock/sdk-ui/components/input", () => ({
  Input: ({ value }: { value?: string }) =>
    createElement("input", { defaultValue: value }),
}));

vi.mock("@bedrock/sdk-ui/components/popover", () => ({
  Popover: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  PopoverContent: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  PopoverTrigger: ({
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

vi.mock("@bedrock/sdk-ui/components/sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@bedrock/sdk-ui/components/table", () => ({
  Table: ({ children }: { children?: ReactNode }) =>
    createElement("table", null, children),
  TableBody: ({ children }: { children?: ReactNode }) =>
    createElement("tbody", null, children),
  TableCell: ({
    children,
    colSpan,
  }: {
    children?: ReactNode;
    colSpan?: number;
  }) => createElement("td", { colSpan }, children),
  TableHead: ({ children }: { children?: ReactNode }) =>
    createElement("th", null, children),
  TableHeader: ({ children }: { children?: ReactNode }) =>
    createElement("thead", null, children),
  TableRow: ({ children }: { children?: ReactNode }) =>
    createElement("tr", null, children),
}));

vi.mock("@bedrock/sdk-ui/components/alert", () => ({
  Alert: ({ children }: { children?: ReactNode }) =>
    createElement("section", null, children),
  AlertDescription: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  AlertTitle: ({ children }: { children?: ReactNode }) =>
    createElement("h4", null, children),
}));

vi.mock("@bedrock/sdk-ui/components/badge", () => ({
  Badge: ({ children }: { children?: ReactNode }) =>
    createElement("span", null, children),
}));

vi.mock("@/features/treasury/deals/components/workspace-layout", () => ({
  FinanceDealWorkspaceLayout: ({
    actions,
    children,
  }: {
    actions?: ReactNode;
    children?: ReactNode;
  }) => createElement(Fragment, null, actions, children),
}));

vi.mock("@/lib/resources/http", () => ({
  executeMutation: vi.fn(),
}));

function createData(): FinanceRouteComposerData {
  return {
    currencies: [
      {
        code: "RUB",
        id: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        label: "RUB · Российский рубль",
        name: "Российский рубль",
      },
      {
        code: "USD",
        id: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
        label: "USD · Доллар США",
        name: "Доллар США",
      },
    ],
    deal: {
      agreementId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      amount: "125000.00",
      calculationId: null,
      createdAt: "2026-04-02T08:07:00.000Z",
      currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      customerId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      id: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      status: "draft",
      type: "payment",
      updatedAt: "2026-04-02T08:07:00.000Z",
    },
    lookupContext: {
      lookupDefaults: {
        defaultLimit: 20,
        maxLimit: 50,
        prefixMatching: true,
      },
      participantKinds: [
        {
          backedBy: "customers",
          description: "Commercial customer root",
          internalOnly: false,
          kind: "customer",
          label: "Клиент",
          note: null,
        },
        {
          backedBy: "counterparties",
          description: "External legal entity",
          internalOnly: false,
          kind: "counterparty",
          label: "Контрагент",
          note: null,
        },
        {
          backedBy: "organizations",
          description: "Internal treasury entity",
          internalOnly: true,
          kind: "organization",
          label: "Организация",
          note: null,
        },
      ],
      roleHints: [],
      strictSemantics: {
        accessControlOwnedByIam: true,
        customerLegalEntitiesViaCounterparties: true,
        organizationsInternalOnly: true,
        subAgentsRequireCanonicalProfile: true,
      },
    },
    route: {
      costComponents: [
        {
          basisType: "deal_source_amount",
          bps: "15",
          classification: "expense",
          code: "liquidity_fee",
          currencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
          family: "provider_fee",
          fixedAmountMinor: null,
          formulaType: "bps",
          id: "c14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          includedInClientRate: false,
          legCode: "fx",
          manualAmountMinor: null,
          notes: null,
          perMillion: null,
          roundingMode: "half_up",
          sequence: 1,
        },
      ],
      createdAt: "2026-04-02T08:10:00.000Z",
      dealId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      id: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      isCurrent: true,
      legs: [
        {
          code: "collect",
          executionCounterpartyId: null,
          expectedFromAmountMinor: "12500000",
          expectedRateDen: null,
          expectedRateNum: null,
          expectedToAmountMinor: "12500000",
          fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
          fromParticipantCode: "cust",
          id: "b14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          idx: 1,
          kind: "collection",
          notes: null,
          settlementModel: "incoming_receipt",
          toCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
          toParticipantCode: "hub",
        },
      ],
      participants: [
        {
          code: "cust",
          displayNameSnapshot: "ООО Ромашка",
          id: "d14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          metadata: {},
          partyId: "e14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          partyKind: "counterparty",
          requisiteId: null,
          role: "source_customer",
          sequence: 1,
        },
        {
          code: "hub",
          displayNameSnapshot: "Bedrock Treasury",
          id: "f14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          metadata: {},
          partyId: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          partyKind: "organization",
          requisiteId: null,
          role: "treasury_hub",
          sequence: 2,
        },
      ],
      routeId: "214fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      validationIssues: [
        {
          code: "leg.currency.mismatch",
          message: "Leg currencies must match settlement semantics",
          path: "legs[0].toCurrencyId",
          severity: "warning",
        },
      ],
      version: 3,
    },
    templates: [
      {
        code: "rub-usd-payout",
        createdAt: "2026-04-01T08:00:00.000Z",
        dealType: "payment",
        description: "RUB collection to USD payout",
        id: "314fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        name: "RUB -> USD payout",
        status: "published",
        updatedAt: "2026-04-01T08:00:00.000Z",
      },
    ],
    workspace: {
      acceptedCalculation: null,
      actions: {
        canAcceptCalculation: false,
        canCloseDeal: false,
        canCreateCalculation: true,
        canCreateQuote: true,
        canRecordCashMovement: false,
        canRecordExecutionFee: false,
        canRecordExecutionFill: false,
        canRequestExecution: false,
        canRunReconciliation: false,
        canResolveExecutionBlocker: false,
        canSupersedeCalculation: false,
        canUploadAttachment: true,
      },
      attachmentRequirements: [],
      closeReadiness: {
        blockers: [],
        criteria: [],
        ready: false,
      },
      executionPlan: [],
      formalDocumentRequirements: [],
      instructionSummary: {
        failed: 0,
        planned: 0,
        prepared: 0,
        returnRequested: 0,
        returned: 0,
        settled: 0,
        submitted: 0,
        terminalOperations: 0,
        totalOperations: 0,
        voided: 0,
      },
      nextAction: "Create calculation from route",
      operationalState: {
        positions: [],
      },
      pricing: {
        fundingMessage: null,
        fundingResolution: {
          availableMinor: null,
          fundingOrganizationId: null,
          fundingRequisiteId: null,
          reasonCode: null,
          requiredAmountMinor: null,
          state: "not_applicable",
          strategy: null,
          targetCurrency: null,
          targetCurrencyId: null,
        },
        quoteAmount: "125000.00",
        quoteAmountSide: "source",
        quoteEligibility: true,
        sourceCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
      },
      profitabilitySnapshot: null,
      profitabilityVariance: null,
      queueContext: {
        blockers: [],
        queue: "funding",
        queueReason: "Create calculation from route",
      },
      reconciliationSummary: {
        ignoredExceptionCount: 0,
        lastActivityAt: null,
        openExceptionCount: 0,
        pendingOperationCount: 0,
        reconciledOperationCount: 0,
        requiredOperationCount: 0,
        resolvedExceptionCount: 0,
        state: "not_started",
      },
      relatedResources: {
        attachments: [],
        formalDocuments: [],
        operations: [],
        quotes: [],
        reconciliationExceptions: [],
      },
      summary: {
        applicantDisplayName: "ООО Ромашка",
        calculationId: null,
        createdAt: "2026-04-02T08:07:00.000Z",
        id: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        internalEntityDisplayName: "Bedrock Treasury",
        status: "draft",
        type: "payment",
        updatedAt: "2026-04-02T08:07:00.000Z",
      },
      timeline: [],
    },
  };
}

describe("route composer workspace", () => {
  it("renders route tables, template picker, and validation banner", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { RouteComposerWorkspace } = await import(
      "@/features/treasury/deals/components/route-composer"
    );

    const markup = renderToStaticMarkup(
      createElement(RouteComposerWorkspace, {
        data: createData(),
      }),
    );

    expect(markup).toContain("Шаблон маршрута");
    expect(markup).toContain("Участники маршрута");
    expect(markup).toContain("Этапы маршрута");
    expect(markup).toContain("Компоненты экономики");
    expect(markup).toContain("RUB -&gt; USD payout");
    expect(markup).toContain("ООО Ромашка");
    expect(markup).toContain("leg.currency.mismatch");
    expect(markup).toContain("Создать calculation");
  });
});
