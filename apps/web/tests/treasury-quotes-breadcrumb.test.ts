import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCounterpartyById = vi.fn();
const getCurrencyById = vi.fn();
const getCustomerById = vi.fn();
const getDocumentDetails = vi.fn();
const getFxQuoteDetails = vi.fn();
const getOrganizationById = vi.fn();
const getRequisiteById = vi.fn();
const getRequisiteProviderById = vi.fn();
const getUserById = vi.fn();

vi.mock("@/features/entities/counterparties/lib/queries", () => ({
  getCounterpartyById,
}));

vi.mock("@/features/entities/currencies/lib/queries", () => ({
  getCurrencyById,
}));

vi.mock("@/features/entities/customers/lib/queries", () => ({
  getCustomerById,
}));

vi.mock("@/features/entities/organizations/lib/queries", () => ({
  getOrganizationById,
}));

vi.mock("@/features/entities/requisite-providers/lib/queries", () => ({
  getRequisiteProviderById,
}));

vi.mock("@/features/entities/requisites/lib/queries", () => ({
  getRequisiteById,
}));

vi.mock("@/features/documents/lib/doc-types", () => ({
  getDocumentTypeLabel: () => "Документ",
  isKnownDocumentType: () => false,
}));

vi.mock("@/features/documents/lib/breadcrumbs", () => ({
  buildDocumentDetailsBreadcrumbItems: vi.fn(),
  getDocumentDetailsBreadcrumbParams: vi.fn(() => null),
  resolveDocumentCreateBreadcrumbItems: vi.fn(() => null),
}));

vi.mock("@/features/operations/documents/lib/queries", () => ({
  getDocumentDetails,
}));

vi.mock("@/features/treasury/quotes/lib/queries", () => ({
  getFxQuoteDetails,
}));

vi.mock("@/app/(shell)/users/lib/queries", () => ({
  getUserById,
}));

vi.mock("@/components/dynamic-breadcrumb", () => ({
  DynamicBreadcrumb: ({
    items,
  }: {
    items: Array<{ href?: string; label: string }>;
  }) =>
    React.createElement(
      "nav",
      null,
      items.map((item) =>
        React.createElement(
          "span",
          {
            key: `${item.href ?? ""}:${item.label}`,
            "data-href": item.href ?? "",
          },
          `${item.label}${item.href ? `:${item.href}` : ""}`,
        ),
      ),
    ),
}));

describe("treasury quotes breadcrumb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrganizationById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000320",
      shortName: "Multihansa",
    });
    getFxQuoteDetails.mockResolvedValue({
      quote: {
        id: "quote-1",
        idempotencyKey: "quote-ref-1",
        fromCurrencyId: "currency-usd",
        toCurrencyId: "currency-eur",
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "100000",
        toAmountMinor: "91500",
        pricingMode: "auto_cross",
        pricingTrace: {},
        dealDirection: null,
        dealForm: null,
        rateNum: "915",
        rateDen: "1000",
        status: "active",
        usedByRef: null,
        usedAt: null,
        expiresAt: "2026-03-27T10:15:00.000Z",
        createdAt: "2026-03-27T10:00:00.000Z",
      },
      legs: [],
      feeComponents: [],
      financialLines: [],
      pricingTrace: {},
    });
  });

  it("resolves treasury quote detail breadcrumbs through quote data", async () => {
    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const markup = renderToStaticMarkup(
      await BreadcrumbSegmentsPage({
        params: Promise.resolve({
          segments: ["treasury", "quotes", "quote-ref-1"],
        }),
      }),
    );

    expect(markup).toContain("Казначейство");
    expect(markup).toContain("Котировки");
    expect(markup).toContain("USD / EUR");
    expect(getFxQuoteDetails).toHaveBeenCalledWith("quote-ref-1");
  });

  it("keeps treasury organization breadcrumbs inside the treasury workspace", async () => {
    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const markup = renderToStaticMarkup(
      await BreadcrumbSegmentsPage({
        params: Promise.resolve({
          segments: [
            "treasury",
            "organizations",
            "00000000-0000-4000-8000-000000000320",
            "requisites",
          ],
        }),
      }),
    );

    expect(markup).toContain("Казначейство");
    expect(markup).toContain("Организации");
    expect(markup).toContain("Multihansa");
    expect(markup).toContain("/treasury/organizations/00000000-0000-4000-8000-000000000320");
    expect(markup).not.toContain("/entities/organizations/00000000-0000-4000-8000-000000000320");
  });
});
