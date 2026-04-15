import React, { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FinanceRouteTemplateWorkspace } from "@/features/treasury/route-templates/lib/queries";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    replace: vi.fn(),
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
  Archive: () => null,
  Check: () => null,
  Plus: () => null,
  RotateCcw: () => null,
  Save: () => null,
  Send: () => null,
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

vi.mock("@bedrock/sdk-ui/components/input", () => ({
  Input: ({ value }: { value?: string }) =>
    createElement("input", { defaultValue: value }),
}));

vi.mock("@bedrock/sdk-ui/components/textarea", () => ({
  Textarea: ({ value }: { value?: string }) =>
    createElement("textarea", null, value),
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

vi.mock("@/features/treasury/ui/native-select", () => ({
  NativeSelect: ({
    children,
  }: {
    children?: ReactNode;
  }) => createElement("select", null, children),
}));

vi.mock("@/features/treasury/ui/participant-lookup-combobox", () => ({
  ParticipantLookupCombobox: ({
    placeholder,
    valueLabel,
  }: {
    placeholder: string;
    valueLabel?: string | null;
  }) => createElement("button", null, valueLabel ?? placeholder),
}));

vi.mock("@/features/treasury/route-templates/components/workspace-layout", () => ({
  RouteTemplateWorkspaceLayout: ({
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

function createData(): FinanceRouteTemplateWorkspace {
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
    template: {
      code: "rub-usd-payout",
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
          legCode: "collect",
          manualAmountMinor: null,
          notes: null,
          perMillion: null,
          roundingMode: "half_up",
          sequence: 1,
        },
      ],
      createdAt: "2026-04-01T08:00:00.000Z",
      dealType: "payment",
      description: "RUB collection -> USD payout",
      id: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      legs: [
        {
          code: "collect",
          executionCounterpartyId: null,
          expectedFromAmountMinor: "12500000",
          expectedRateDen: null,
          expectedRateNum: null,
          expectedToAmountMinor: "12500000",
          fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
          fromParticipantCode: "customer",
          id: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          idx: 1,
          kind: "collection",
          notes: null,
          settlementModel: "incoming_receipt",
          toCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
          toParticipantCode: "ops",
        },
      ],
      name: "RUB -> USD payout",
      participants: [
        {
          bindingKind: "deal_customer",
          code: "customer",
          displayNameTemplate: "Customer",
          id: "b14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          metadata: {},
          partyId: null,
          partyKind: "customer",
          requisiteId: null,
          role: "source_customer",
          sequence: 1,
        },
        {
          bindingKind: "fixed_party",
          code: "ops",
          displayNameTemplate: "Multihansa",
          id: "b24fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          metadata: {},
          partyId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          partyKind: "organization",
          requisiteId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          role: "treasury_hub",
          sequence: 2,
        },
      ],
      status: "draft",
      updatedAt: "2026-04-02T08:00:00.000Z",
    },
  };
}

describe("route template workspace", () => {
  it("renders the template editor sections", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { RouteTemplateWorkspace } = await import(
      "@/features/treasury/route-templates/components/workspace"
    );

    const html = renderToStaticMarkup(
      createElement(RouteTemplateWorkspace, {
        data: createData(),
      }),
    );

    expect(html).toContain("Основные параметры");
    expect(html).toContain("Участники шаблона");
    expect(html).toContain("Этапы маршрута");
    expect(html).toContain("Компоненты экономики");
    expect(html).toContain("Сводка шаблона");
    expect(html).toContain("Опубликовать");
  });
});
