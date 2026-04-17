import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const REDIRECT = new Error("REDIRECT");
const NOT_FOUND = new Error("NOT_FOUND");

const redirect = vi.fn(() => {
  throw REDIRECT;
});
const notFound = vi.fn(() => {
  throw NOT_FOUND;
});
const parseSearchParams = vi.fn();
const getPaymentRouteConstructorOptions = vi.fn();
const getPaymentRoutesList = vi.fn();
const getPaymentRouteTemplateById = vi.fn();
const PaymentRoutesTable = vi.fn(() => null);
const PaymentRouteConstructorClient = vi.fn(() => null);

vi.mock("next/navigation", () => ({
  notFound,
  redirect,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("lucide-react", () => ({
  GitBranch: () => null,
}));

vi.mock("@bedrock/sdk-ui/components/button", () => ({
  Button: ({ children, render }: { children?: React.ReactNode; render?: React.ReactNode }) =>
    render ?? children ?? null,
}));

vi.mock("@bedrock/sdk-tables-ui/components/data-table-skeleton", () => ({
  DataTableSkeleton: () => null,
}));

vi.mock("@/components/entities/entity-list-page-shell", () => ({
  EntityListPageShell: ({
    actions,
    children,
    description,
    title,
  }: {
    actions?: React.ReactNode;
    children?: React.ReactNode;
    description?: string;
    title?: string;
  }) =>
    React.createElement(
      "section",
      {
        "data-description": description,
        "data-title": title,
      },
      actions,
      children,
    ),
}));

vi.mock("@/features/payment-routes/components/list-table", () => ({
  PaymentRoutesTable,
}));

vi.mock("@/features/payment-routes/components/constructor-client", () => ({
  PaymentRouteConstructorClient,
}));

vi.mock("@/features/payment-routes/lib/validations", () => ({
  searchParamsCache: {
    parse: parseSearchParams,
  },
}));

vi.mock("@/features/payment-routes/lib/queries", () => ({
  getPaymentRouteConstructorOptions,
  getPaymentRoutesList,
  getPaymentRouteTemplateById,
}));

const OPTIONS = {
  counterparties: [],
  currencies: [
    {
      code: "USD",
      id: "00000000-0000-4000-8000-000000000101",
      label: "USD - US Dollar",
      name: "US Dollar",
      precision: 2,
    },
  ],
  customers: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      label: "Acme Customer",
      name: "Acme Customer",
    },
  ],
  organizations: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      label: "Bedrock Treasury",
      shortName: "Bedrock Treasury",
    },
  ],
} as const;

const TEMPLATE = {
  createdAt: "2026-04-16T08:00:00.000Z",
  draft: {
    additionalFees: [],
    amountInMinor: "10000",
    amountOutMinor: "10000",
    currencyInId: OPTIONS.currencies[0].id,
    currencyOutId: OPTIONS.currencies[0].id,
    legs: [
      {
        fees: [],
        fromCurrencyId: OPTIONS.currencies[0].id,
        id: "leg-1",
        toCurrencyId: OPTIONS.currencies[0].id,
      },
    ],
    lockedSide: "currency_in",
    participants: [
      {
        binding: "bound",
        displayName: "Acme Customer",
        entityId: OPTIONS.customers[0].id,
        entityKind: "customer",
        nodeId: "node-customer",
        role: "source",
      },
      {
        binding: "bound",
        displayName: "Bedrock Treasury",
        entityId: OPTIONS.organizations[0].id,
        entityKind: "organization",
        nodeId: "node-organization",
        role: "destination",
      },
    ],
  },
  id: "00000000-0000-4000-8000-000000000004",
  lastCalculation: null,
  name: "USD payout",
  snapshotPolicy: "clone_on_attach",
  status: "active",
  updatedAt: "2026-04-16T08:00:00.000Z",
  visual: {
    nodePositions: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  },
} as const;

describe("payment route pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    parseSearchParams.mockImplementation(async (input) => ({
      page: 1,
      perPage: 20,
      ...(await input),
    }));
    getPaymentRouteConstructorOptions.mockResolvedValue(OPTIONS);
    getPaymentRoutesList.mockResolvedValue({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    getPaymentRouteTemplateById.mockResolvedValue(TEMPLATE);
  });

  it("redirects /routes to /routes/list", async () => {
    const { default: RoutesPage } = await import("@/app/(shell)/routes/page");

    expect(() => RoutesPage()).toThrow(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/routes/list");
  });

  it("loads the route catalog page with parsed filters and constructor action", async () => {
    const { default: PaymentRoutesListPage } = await import(
      "@/app/(shell)/routes/list/page"
    );

    const html = renderToStaticMarkup(
      await PaymentRoutesListPage({
        searchParams: Promise.resolve({
          status: "active",
        }),
      }),
    );

    expect(parseSearchParams).toHaveBeenCalled();
    expect(getPaymentRouteConstructorOptions).toHaveBeenCalled();
    expect(getPaymentRoutesList).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      status: "active",
    });
    expect(PaymentRoutesTable).toHaveBeenCalledTimes(1);
    const tableProps = PaymentRoutesTable.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(tableProps).toMatchObject({
      currencies: OPTIONS.currencies,
    });
    expect(html).toContain("/routes/constructor");
    expect(html).toContain("Список маршрутов");
  });

  it("loads the create constructor page with empty template state", async () => {
    const { default: PaymentRouteConstructorPage } = await import(
      "@/app/(shell)/routes/constructor/page"
    );

    renderToStaticMarkup(await PaymentRouteConstructorPage());

    expect(getPaymentRouteConstructorOptions).toHaveBeenCalled();
    expect(PaymentRouteConstructorClient).toHaveBeenCalledWith(
      {
        options: OPTIONS,
        template: null,
      },
      undefined,
    );
  });

  it("loads the edit constructor page and rejects unknown templates", async () => {
    const { default: PaymentRouteConstructorDetailPage } = await import(
      "@/app/(shell)/routes/constructor/[id]/page"
    );

    renderToStaticMarkup(
      await PaymentRouteConstructorDetailPage({
        params: Promise.resolve({
          id: TEMPLATE.id,
        }),
      }),
    );

    expect(getPaymentRouteTemplateById).toHaveBeenCalledWith(TEMPLATE.id);
    expect(PaymentRouteConstructorClient).toHaveBeenCalledWith(
      {
        options: OPTIONS,
        template: TEMPLATE,
      },
      undefined,
    );

    getPaymentRouteTemplateById.mockResolvedValueOnce(null);

    await expect(
      PaymentRouteConstructorDetailPage({
        params: Promise.resolve({
          id: "00000000-0000-4000-8000-000000000099",
        }),
      }),
    ).rejects.toBe(NOT_FOUND);
  });
});
