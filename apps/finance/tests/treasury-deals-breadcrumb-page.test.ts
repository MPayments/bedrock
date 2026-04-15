import React from "react";
import { describe, expect, it, vi } from "vitest";

const getCounterpartyById = vi.fn();
const getCurrencyById = vi.fn();
const getCustomerById = vi.fn();
const getFinanceDealBreadcrumbById = vi.fn();
const getFinanceRouteTemplateById = vi.fn();
const getOrganizationById = vi.fn();
const getRequisiteProviderById = vi.fn();
const getRequisiteById = vi.fn();
const getTreasuryOperationById = vi.fn();
const getUserById = vi.fn();
const getDocumentDetails = vi.fn();

vi.mock("@/features/entities/counterparties/lib/queries", () => ({
  getCounterpartyById,
}));

vi.mock("@/features/entities/currencies/lib/queries", () => ({
  getCurrencyById,
}));

vi.mock("@/features/entities/customers/lib/queries", () => ({
  getCustomerById,
}));

vi.mock("@/features/treasury/deals/lib/queries", () => ({
  getFinanceDealBreadcrumbById,
}));

vi.mock("@/features/treasury/route-templates/lib/queries", () => ({
  getFinanceRouteTemplateById,
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

vi.mock("@/features/treasury/operations/lib/queries", () => ({
  getTreasuryOperationById,
}));

vi.mock("@/app/(shell)/users/lib/queries", () => ({
  getUserById,
}));

vi.mock("@/features/operations/documents/lib/queries", () => ({
  getDocumentDetails,
}));

vi.mock("@/components/dynamic-breadcrumb", () => ({
  DynamicBreadcrumb: vi.fn(() => null),
}));

describe("treasury deals breadcrumb page", () => {
  it("builds a localized breadcrumb for deal workspaces", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getFinanceDealBreadcrumbById.mockResolvedValue({
      summary: {
        applicantDisplayName: "ООО Ромашка",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "exporter_settlement",
      },
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "treasury",
          "deals",
          "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Сделки",
        href: "/treasury/deals",
        icon: "handshake",
      },
      {
        label: "Расчеты с экспортером • ООО Ромашка",
        href: "/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    ]);
  }, 15_000);

  it("adds the compose segment label for route composer pages", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getFinanceDealBreadcrumbById.mockResolvedValue({
      summary: {
        applicantDisplayName: "ООО Ромашка",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "payment",
      },
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "treasury",
          "deals",
          "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          "compose",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Сделки",
        href: "/treasury/deals",
        icon: "handshake",
      },
      {
        label: "Платеж поставщику • ООО Ромашка",
        href: "/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
      {
        label: "Маршрут",
      },
    ]);
  });

  it("adds the calculation segment label for calculation workspace pages", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getFinanceDealBreadcrumbById.mockResolvedValue({
      summary: {
        applicantDisplayName: "ООО Ромашка",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "payment",
      },
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "treasury",
          "deals",
          "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          "calculation",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Сделки",
        href: "/treasury/deals",
        icon: "handshake",
      },
      {
        label: "Платеж поставщику • ООО Ромашка",
        href: "/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
      {
        label: "Расчет",
      },
    ]);
  });

  it("adds the execution segment label for execution workspace pages", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getFinanceDealBreadcrumbById.mockResolvedValue({
      summary: {
        applicantDisplayName: "ООО Ромашка",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "payment",
      },
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "treasury",
          "deals",
          "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          "execution",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Сделки",
        href: "/treasury/deals",
        icon: "handshake",
      },
      {
        label: "Платеж поставщику • ООО Ромашка",
        href: "/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
      {
        label: "Исполнение",
      },
    ]);
  });

  it("adds the reconciliation segment label for reconciliation workspace pages", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getFinanceDealBreadcrumbById.mockResolvedValue({
      summary: {
        applicantDisplayName: "ООО Ромашка",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "payment",
      },
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "treasury",
          "deals",
          "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          "reconciliation",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Сделки",
        href: "/treasury/deals",
        icon: "handshake",
      },
      {
        label: "Платеж поставщику • ООО Ромашка",
        href: "/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
      {
        label: "Сверка",
      },
    ]);
  });

  it("builds a breadcrumb for route template details", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getFinanceRouteTemplateById.mockResolvedValue({
      code: "rub-usd-payout",
      costComponents: [],
      createdAt: "2026-04-01T08:00:00.000Z",
      dealType: "payment",
      description: "RUB collection -> USD payout",
      id: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      legs: [],
      name: "RUB -> USD payout",
      participants: [],
      status: "draft",
      updatedAt: "2026-04-02T08:00:00.000Z",
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: ["route-templates", "914fb6eb-a1bd-429e-9628-e97d0f2efa0b"],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Шаблоны маршрутов",
        href: "/route-templates",
        icon: "workflow",
      },
      {
        label: "RUB -> USD payout",
        href: "/route-templates/914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    ]);
  });

  it("uses treasury canonical links for organization breadcrumbs", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getOrganizationById.mockResolvedValue({
      id: "org-1",
      shortName: "Bedrock Treasury",
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: ["treasury", "organizations", "org-1"],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Организации",
        href: "/treasury/organizations",
        icon: "landmark",
      },
      {
        label: "Bedrock Treasury",
        href: "/treasury/organizations/org-1",
      },
    ]);
  });

  it("builds a localized breadcrumb for treasury operations", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getTreasuryOperationById.mockResolvedValue({
      dealRef: {
        applicantName: "ООО Ромашка",
        dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        status: "executing",
        type: "payment",
      },
      id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      kind: "payout",
    });

    const { default: BreadcrumbSegmentsPage } = await import(
      "@/app/(shell)/@breadcrumb/[...segments]/page"
    );

    const element = await BreadcrumbSegmentsPage({
      params: Promise.resolve({
        segments: [
          "treasury",
          "operations",
          "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        ],
      }),
    });

    expect(element.props.items).toEqual([
      {
        label: "Казначейство",
        href: "/treasury",
        icon: "landmark",
      },
      {
        label: "Операции",
        href: "/treasury/operations",
        icon: "workflow",
      },
      {
        label: "Выплата • ООО Ромашка",
        href: "/treasury/operations/114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    ]);
  });
});
