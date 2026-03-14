import { describe, expect, it } from "vitest";

import { resolveBreadcrumbItems } from "@/lib/breadcrumbs";

describe("breadcrumbs", () => {
  it("uses canonical hrefs for static workspace segments", async () => {
    await expect(resolveBreadcrumbItems(["accounting", "accounts"])).resolves.toEqual([
      { label: "Бухгалтерия", href: "/accounting", icon: "book-open" },
      { label: "Счета", href: "/accounting/accounts", icon: "wallet" },
    ]);

    await expect(resolveBreadcrumbItems(["fx", "rates"])).resolves.toEqual([
      { label: "FX", href: "/fx", icon: "currency" },
      { label: "Курсы", href: "/fx/rates", icon: "chart-candlestick" },
    ]);

    await expect(resolveBreadcrumbItems(["fx", "quotes"])).resolves.toEqual([
      { label: "FX", href: "/fx", icon: "currency" },
      { label: "Котировки", href: "/fx/quotes", icon: "ticket-percent" },
    ]);
  });

  it("uses canonical hrefs for entity counterparties and treasury organizations", async () => {
    await expect(resolveBreadcrumbItems(["entities", "customers"])).resolves.toEqual([
      { label: "Справочники", href: "/entities", icon: "book-open" },
      { label: "Клиенты", href: "/entities/customers", icon: "handshake" },
    ]);

    await expect(resolveBreadcrumbItems(["entities", "counterparties"])).resolves.toEqual([
      { label: "Справочники", href: "/entities", icon: "book-open" },
      { label: "Контрагенты", href: "/entities/counterparties", icon: "building-2" },
    ]);

    await expect(resolveBreadcrumbItems(["treasury", "organizations"])).resolves.toEqual([
      { label: "Казначейство", href: "/treasury", icon: "landmark" },
      { label: "Организации", href: "/treasury/organizations", icon: "landmark" },
    ]);
  });

  it("points transfers breadcrumbs to the documents workspace", async () => {
    await expect(resolveBreadcrumbItems(["documents", "transfers"])).resolves.toEqual([
      { label: "Документы", href: "/documents", icon: "book-open" },
      {
        label: "Переводы",
        href: "/documents/transfers",
        icon: "arrow-right-left",
      },
    ]);
  });
});
