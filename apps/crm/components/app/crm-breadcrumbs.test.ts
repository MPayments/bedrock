import { describe, expect, it } from "vitest";

import {
  buildBreadcrumbOverrideLookup,
  buildCrmBreadcrumbs,
  formatDealBreadcrumbLabel,
  removeBreadcrumbOverrides,
  type BreadcrumbOverrideState,
  resolveCounterpartyBreadcrumbLabel,
  upsertBreadcrumbOverrides,
} from "./crm-breadcrumbs";

function summarizeBreadcrumbs(
  pathname: string,
  overrides?: Record<string, string>,
) {
  return buildCrmBreadcrumbs(pathname, overrides).map((item) => ({
    href: item.href,
    label: item.label,
  }));
}

describe("buildCrmBreadcrumbs", () => {
  it("returns only the root breadcrumb on the dashboard home page", () => {
    expect(summarizeBreadcrumbs("/")).toEqual([
      {
        href: "/",
        label: "Главная",
      },
    ]);
  });

  it("builds static dashboard and admin trails", () => {
    expect(summarizeBreadcrumbs("/reports/customers")).toEqual([
      { href: "/", label: "Главная" },
      { href: null, label: "Отчёты" },
      { href: "/reports/customers", label: "По клиентам" },
    ]);

    expect(summarizeBreadcrumbs("/admin/users/new")).toEqual([
      { href: "/", label: "Главная" },
      { href: "/admin/users", label: "Пользователи" },
      { href: "/admin/users/new", label: "Новый пользователь" },
    ]);

    expect(summarizeBreadcrumbs("/customers/new")).toEqual([
      { href: "/", label: "Главная" },
      { href: "/customers", label: "Клиенты" },
      { href: "/customers/new", label: "Новый клиент" },
    ]);
  });

  it("uses semantic fallbacks for dynamic routes without overrides", () => {
    expect(summarizeBreadcrumbs("/deals/deal-1")).toEqual([
      { href: "/", label: "Главная" },
      { href: "/deals", label: "Сделки" },
      { href: "/deals/deal-1", label: "Сделка" },
    ]);

    expect(
      summarizeBreadcrumbs("/customers/customer-1/counterparties/counterparty-1"),
    ).toEqual([
      { href: "/", label: "Главная" },
      { href: "/customers", label: "Клиенты" },
      { href: "/customers/customer-1", label: "Клиент" },
      {
        href: "/customers/customer-1/counterparties",
        label: "Субъекты сделки",
      },
      {
        href: "/customers/customer-1/counterparties/counterparty-1",
        label: "Контрагент",
      },
    ]);

    expect(summarizeBreadcrumbs("/admin/organizations/org-1")).toEqual([
      { href: "/", label: "Главная" },
      { href: "/admin/organizations", label: "Юрлица" },
      { href: "/admin/organizations/org-1", label: "Юрлицо" },
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
      { href: "/", label: "Главная" },
      { href: "/customers", label: "Клиенты" },
      { href: "/customers/customer-1", label: "Acme Trade" },
      {
        href: "/customers/customer-1/counterparties",
        label: "Субъекты сделки",
      },
      {
        href: "/customers/customer-1/counterparties/counterparty-1",
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
      { href: "/", label: "Главная" },
      { href: "/customers", label: "Клиенты" },
      { href: "/customers/customer-1", label: "Клиент" },
      {
        href: "/customers/customer-1/counterparties",
        label: "Субъекты сделки",
      },
      {
        href: "/customers/customer-1/counterparties/counterparty-1",
        label: "Контрагент",
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
