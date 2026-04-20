import { describe, expect, it } from "vitest";

import {
  buildBreadcrumbOverrideLookup,
  buildCrmBreadcrumbs,
  formatDealBreadcrumbLabel,
  removeBreadcrumbOverrides,
  type BreadcrumbOverrideState,
  resolveCounterpartyBreadcrumbLabel,
  upsertBreadcrumbOverrides,
} from "./breadcrumbs";

function summarizeBreadcrumbs(
  pathname: string,
  overrides?: Record<string, string>,
  searchParams?: string,
) {
  return buildCrmBreadcrumbs(pathname, overrides, searchParams).map((item) => ({
    href: item.href,
    icon: item.icon,
    iconOnly: item.iconOnly ?? false,
    label: item.label,
  }));
}

describe("buildCrmBreadcrumbs", () => {
  it("returns only the root breadcrumb on the dashboard home page", () => {
    expect(summarizeBreadcrumbs("/")).toEqual([
      {
        href: "/",
        icon: "home",
        iconOnly: true,
        label: "Главная",
      },
    ]);
  });

  it("builds static dashboard and admin trails", () => {
    expect(summarizeBreadcrumbs("/reports/customers")).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      { href: null, icon: "reports", iconOnly: false, label: "Отчёты" },
      {
        href: "/reports/customers",
        icon: "reports",
        iconOnly: false,
        label: "По клиентам",
      },
    ]);

    expect(summarizeBreadcrumbs("/admin/users/new")).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      {
        href: "/admin/users",
        icon: "user",
        iconOnly: false,
        label: "Пользователи",
      },
      {
        href: "/admin/users/new",
        icon: "user",
        iconOnly: false,
        label: "Новый пользователь",
      },
    ]);

    expect(summarizeBreadcrumbs("/customers/new")).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      {
        href: "/customers",
        icon: "customer",
        iconOnly: false,
        label: "Клиенты",
      },
      {
        href: "/customers/new",
        icon: "customer",
        iconOnly: false,
        label: "Новый клиент",
      },
    ]);
  });

  it("uses semantic fallbacks for dynamic routes without overrides", () => {
    expect(summarizeBreadcrumbs("/deals/deal-1")).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      { href: "/deals", icon: "deal", iconOnly: false, label: "Сделки" },
      {
        href: "/deals/deal-1",
        icon: "deal",
        iconOnly: false,
        label: "Сделка",
      },
    ]);

    expect(
      summarizeBreadcrumbs("/customers/customer-1/counterparties/counterparty-1"),
    ).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      {
        href: "/customers",
        icon: "customer",
        iconOnly: false,
        label: "Клиенты",
      },
      {
        href: "/customers/customer-1",
        icon: "customer",
        iconOnly: false,
        label: "Клиент",
      },
      {
        href: "/customers/customer-1?tab=counterparties",
        icon: "counterparty",
        iconOnly: false,
        label: "Контрагенты",
      },
      {
        href: "/customers/customer-1/counterparties/counterparty-1",
        icon: "counterparty",
        iconOnly: false,
        label: "Контрагент",
      },
    ]);

    expect(summarizeBreadcrumbs("/admin/organizations/org-1")).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      {
        href: "/admin/organizations",
        icon: "organization",
        iconOnly: false,
        label: "Юрлица",
      },
      {
        href: "/admin/organizations/org-1",
        icon: "organization",
        iconOnly: false,
        label: "Юрлицо",
      },
    ]);
  });

  it("adds a tab breadcrumb for customer documents", () => {
    expect(
      summarizeBreadcrumbs(
        "/customers/customer-1",
        {
          "/customers/customer-1": "Acme Trade",
        },
        "tab=documents",
      ),
    ).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      {
        href: "/customers",
        icon: "customer",
        iconOnly: false,
        label: "Клиенты",
      },
      {
        href: "/customers/customer-1",
        icon: "customer",
        iconOnly: false,
        label: "Acme Trade",
      },
      {
        href: "/customers/customer-1?tab=documents",
        icon: "documents",
        iconOnly: false,
        label: "Документы",
      },
    ]);
  });

  it("applies registered overrides and falls back again after cleanup", () => {
    let state: BreadcrumbOverrideState = {};

    state = upsertBreadcrumbOverrides(state, "customer-page", [
      {
        href: "/customers/customer-1",
        label: "Acme Trade",
      },
      {
        href: "/customers/customer-1/counterparties/counterparty-1",
        label: "Beta Export",
      },
    ]);

    expect(
      summarizeBreadcrumbs(
        "/customers/customer-1/counterparties/counterparty-1",
        buildBreadcrumbOverrideLookup(state),
      ),
    ).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      {
        href: "/customers",
        icon: "customer",
        iconOnly: false,
        label: "Клиенты",
      },
      {
        href: "/customers/customer-1",
        icon: "customer",
        iconOnly: false,
        label: "Acme Trade",
      },
      {
        href: "/customers/customer-1?tab=counterparties",
        icon: "counterparty",
        iconOnly: false,
        label: "Контрагенты",
      },
      {
        href: "/customers/customer-1/counterparties/counterparty-1",
        icon: "counterparty",
        iconOnly: false,
        label: "Beta Export",
      },
    ]);

    state = removeBreadcrumbOverrides(state, "customer-page");

    expect(
      summarizeBreadcrumbs(
        "/customers/customer-1/counterparties/counterparty-1",
        buildBreadcrumbOverrideLookup(state),
      ),
    ).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      {
        href: "/customers",
        icon: "customer",
        iconOnly: false,
        label: "Клиенты",
      },
      {
        href: "/customers/customer-1",
        icon: "customer",
        iconOnly: false,
        label: "Клиент",
      },
      {
        href: "/customers/customer-1?tab=counterparties",
        icon: "counterparty",
        iconOnly: false,
        label: "Контрагенты",
      },
      {
        href: "/customers/customer-1/counterparties/counterparty-1",
        icon: "counterparty",
        iconOnly: false,
        label: "Контрагент",
      },
    ]);
  });

  it("links the counterparty create page back to the customer tab", () => {
    expect(
      summarizeBreadcrumbs("/customers/customer-1/counterparties/new"),
    ).toEqual([
      { href: "/", icon: "home", iconOnly: true, label: "Главная" },
      {
        href: "/customers",
        icon: "customer",
        iconOnly: false,
        label: "Клиенты",
      },
      {
        href: "/customers/customer-1",
        icon: "customer",
        iconOnly: false,
        label: "Клиент",
      },
      {
        href: "/customers/customer-1?tab=counterparties",
        icon: "counterparty",
        iconOnly: false,
        label: "Контрагенты",
      },
      {
        href: "/customers/customer-1/counterparties/new",
        icon: "counterparty",
        iconOnly: false,
        label: "Новый контрагент",
      },
    ]);
  });
});

describe("formatDealBreadcrumbLabel", () => {
  it("combines deal type and applicant name when present", () => {
    expect(
      formatDealBreadcrumbLabel({
        applicantDisplayName: "ООО Ромашка",
        dealTypeLabel: "Платеж поставщику",
      }),
    ).toBe("Платеж поставщику: ООО Ромашка");

    expect(
      formatDealBreadcrumbLabel({
        applicantDisplayName: null,
        dealTypeLabel: "Платеж поставщику",
      }),
    ).toBe("Платеж поставщику");
  });
});

describe("resolveCounterpartyBreadcrumbLabel", () => {
  it("prefers orgName, then shortName, then fullName", () => {
    expect(
      resolveCounterpartyBreadcrumbLabel({
        fullName: "Полное имя",
        orgName: "Орг. имя",
        shortName: "Короткое имя",
      }),
    ).toBe("Орг. имя");

    expect(
      resolveCounterpartyBreadcrumbLabel({
        fullName: "Полное имя",
        orgName: " ",
        shortName: "Короткое имя",
      }),
    ).toBe("Короткое имя");

    expect(
      resolveCounterpartyBreadcrumbLabel({
        fullName: "Полное имя",
        orgName: null,
        shortName: "",
      }),
    ).toBe("Полное имя");

    expect(resolveCounterpartyBreadcrumbLabel(null)).toBeNull();
  });
});
