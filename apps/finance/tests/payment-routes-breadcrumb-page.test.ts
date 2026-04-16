import React from "react";
import { describe, expect, it, vi } from "vitest";

const getCounterpartyById = vi.fn();
const getCurrencyById = vi.fn();
const getCustomerById = vi.fn();
const getDocumentDetails = vi.fn();
const getFinanceDealBreadcrumbById = vi.fn();
const getOrganizationById = vi.fn();
const getPaymentRouteTemplateById = vi.fn();
const getRequisiteProviderById = vi.fn();
const getRequisiteById = vi.fn();
const getTreasuryOperationById = vi.fn();
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

vi.mock("@/features/operations/documents/lib/queries", () => ({
  getDocumentDetails,
}));

vi.mock("@/features/treasury/deals/lib/queries", () => ({
  getFinanceDealBreadcrumbById,
}));

vi.mock("@/features/entities/organizations/lib/queries", () => ({
  getOrganizationById,
}));

vi.mock("@/features/payment-routes/lib/queries", () => ({
  getPaymentRouteTemplateById,
}));

vi.mock("@/features/entities/requisite-providers/lib/queries", () => ({
  getRequisiteProviderById,
}));

vi.mock("@/features/entities/requisites/lib/queries", () => ({
  getRequisiteById,
}));

vi.mock("@/features/treasury/operations/lib/queries", () => ({
  getTreasuryOperationById,
}));

vi.mock("@/app/(shell)/users/lib/queries", () => ({
  getUserById,
}));

vi.mock("@/components/dynamic-breadcrumb", () => ({
  DynamicBreadcrumb: vi.fn(() => null),
}));

describe("payment routes breadcrumb page", () => {
  it("builds a localized breadcrumb for route constructor templates", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getPaymentRouteTemplateById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000004",
      name: "USD payout",
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "routes",
          "constructor",
          "00000000-0000-4000-8000-000000000004",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Маршруты",
        href: "/routes",
        icon: "workflow",
      },
      {
        label: "Конструктор маршрута",
        href: "/routes/constructor",
        icon: "workflow",
      },
      {
        label: "USD payout",
        href: "/routes/constructor/00000000-0000-4000-8000-000000000004",
      },
    ]);
  });
});
